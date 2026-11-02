module.exports = {
  id: '005-public-share-tokens',
  description: 'Replace identifier-based public links with hashed random tokens',
  async up({ mongoose, dryRun }) {
    const notes = mongoose.connection.collection('notes');
    const published = await notes.countDocuments({ isPublished: true });
    if (dryRun) {
      console.log(`would revoke ${published} legacy identifier-based public links`);
      return;
    }
    await notes.updateMany({ isPublished: true }, { $set: { isPublished: false } });
    const shares = mongoose.connection.collection('publicshares');
    await shares.createIndex({ note: 1 }, { unique: true });
    await shares.createIndex({ tokenHash: 1 }, { unique: true });
  },
};
