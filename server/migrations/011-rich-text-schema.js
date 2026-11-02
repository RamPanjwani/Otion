module.exports = {
  id: '011-rich-text-schema',
  description: 'Advance collaborative documents to rich-text schema version 3',
  async up({ mongoose, dryRun }) {
    const notes = mongoose.connection.collection('notes');
    const count = await notes.countDocuments({ contentSchemaVersion: { $lt: 3 } });
    if (dryRun) {
      console.log(`would advance ${count} documents to rich-text schema version 3`);
      return;
    }
    await notes.updateMany({ contentSchemaVersion: { $lt: 3 } }, { $set: { contentSchemaVersion: 3 } });
  },
};
