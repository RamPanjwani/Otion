module.exports = {
  id: '013-flat-notes-and-default-icons',
  description: 'Flatten note hierarchy and add the default note emoji',
  async up({ mongoose, dryRun }) {
    const notes = mongoose.connection.collection('notes');
    const nestedCount = await notes.countDocuments({ parentDocument: { $ne: null } });
    const iconCount = await notes.countDocuments({ $or: [{ icon: '' }, { icon: null }, { icon: { $exists: false } }] });
    if (dryRun) {
      console.log(`would flatten ${nestedCount} notes and add default icons to ${iconCount} notes`);
      return;
    }
    await Promise.all([
      notes.updateMany({ parentDocument: { $ne: null } }, { $set: { parentDocument: null } }),
      notes.updateMany({ $or: [{ icon: '' }, { icon: null }, { icon: { $exists: false } }] }, { $set: { icon: '📝' } }),
    ]);
  },
};
