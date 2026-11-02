module.exports = {
  id: '014-remove-note-covers',
  description: 'Remove legacy note cover image data',
  async up({ mongoose, dryRun }) {
    const notes = mongoose.connection.collection('notes');
    const revisions = mongoose.connection.collection('noterevisions');
    const noteCount = await notes.countDocuments({ coverImage: { $exists: true } });
    const revisionCount = await revisions.countDocuments({ 'snapshot.coverImage': { $exists: true } });
    if (dryRun) {
      console.log(`would remove covers from ${noteCount} notes and ${revisionCount} revisions`);
      return;
    }
    await Promise.all([
      notes.updateMany({ coverImage: { $exists: true } }, { $unset: { coverImage: '' } }),
      revisions.updateMany({ 'snapshot.coverImage': { $exists: true } }, { $unset: { 'snapshot.coverImage': '' } }),
    ]);
  },
};
