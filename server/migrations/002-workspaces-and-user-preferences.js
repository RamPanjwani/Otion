const UserNotePreference = require('../models/UserNotePreference');

module.exports = {
  id: '002-workspaces-and-user-preferences',
  description: 'Migrate user preferences and favorites per user',
  async up({ mongoose, dryRun }) {
    const users = mongoose.connection.collection('users');
    const notes = mongoose.connection.collection('notes');
    const userCount = await users.countDocuments({});
    const favoriteCount = await notes.countDocuments({ isFavorite: true });
    if (dryRun) {
      console.log(`would inspect ${userCount} users and migrate ${favoriteCount} favorites`);
      return;
    }

    const cursor = users.find({}, { projection: { name: 1 } });
    for await (const user of cursor) {
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
    }

    await notes.updateMany({}, { $unset: { isFavorite: '', workspace: '' } });
    await UserNotePreference.createIndexes();
  },
};
