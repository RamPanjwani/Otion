module.exports = {
  id: '004-note-revisions',
  description: 'Initialize revision counters and revision indexes',
  async up({ mongoose, dryRun }) {
    const notes = mongoose.connection.collection('notes');
    const count = await notes.countDocuments({ revisionCounter: { $exists: false } });
    if (dryRun) {
      console.log(`would initialize revision counters on ${count} notes`);
      return;
    }
    await notes.updateMany({ revisionCounter: { $exists: false } }, { $set: { revisionCounter: 0 } });
    const revisions = mongoose.connection.collection('noterevisions');
    await revisions.createIndex({ note: 1, revisionNumber: -1 }, { unique: true });
    await revisions.createIndex({ note: 1, createdAt: -1 });
  },
};
