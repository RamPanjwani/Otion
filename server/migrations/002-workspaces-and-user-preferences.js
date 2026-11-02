const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');
const UserNotePreference = require('../models/UserNotePreference');

module.exports = {
  id: '002-workspaces-and-user-preferences',
  description: 'Create personal workspaces, assign existing notes, and migrate favorites per user',
  async up({ mongoose, dryRun }) {
    const users = mongoose.connection.collection('users');
    const notes = mongoose.connection.collection('notes');
    const userCount = await users.countDocuments({});
    const unassignedCount = await notes.countDocuments({ $or: [{ workspace: null }, { workspace: { $exists: false } }] });
    const favoriteCount = await notes.countDocuments({ isFavorite: true });
    if (dryRun) {
      console.log(`would inspect ${userCount} users, assign ${unassignedCount} notes, and migrate ${favoriteCount} favorites`);
      return;
    }

    const cursor = users.find({}, { projection: { name: 1 } });
    for await (const user of cursor) {
      let membership = await WorkspaceMembership.findOne({ user: user._id, role: 'owner', status: 'active' });
      let workspace;
      if (membership) {
        workspace = membership.workspace;
      } else {
        const created = await Workspace.create({ name: `${user.name}'s Workspace`, owner: user._id });
        workspace = created._id;
        membership = await WorkspaceMembership.create({ workspace, user: user._id, role: 'owner' });
      }

      const favoriteNotes = await notes.find({ user: user._id, isFavorite: true }, { projection: { _id: 1 } }).toArray();
      if (favoriteNotes.length) {
        await UserNotePreference.bulkWrite(favoriteNotes.map((note) => ({
          updateOne: {
            filter: { user: user._id, note: note._id },
            update: { $set: { favorite: true } },
            upsert: true,
          },
        })));
      }
      await notes.updateMany(
        { user: user._id, $or: [{ workspace: null }, { workspace: { $exists: false } }] },
        { $set: { workspace } },
      );
    }

    await notes.updateMany({}, { $unset: { isFavorite: '' } });
    await Promise.all([
      Workspace.createIndexes(),
      WorkspaceMembership.createIndexes(),
      UserNotePreference.createIndexes(),
    ]);
  },
};
