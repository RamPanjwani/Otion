module.exports = {
  id: '008-advanced-sharing',
  description: 'Add commenter permissions and protected public-link metadata',
  async up({ mongoose, dryRun }) {
    const shares = mongoose.connection.collection('publicshares');
    const missing = await shares.countDocuments({ passwordHash: { $exists: false } });
    if (dryRun) {
      console.log(`would initialize password metadata on ${missing} public shares`);
      return;
    }
    await shares.updateMany({ passwordHash: { $exists: false } }, { $set: { passwordHash: null } });
    await shares.createIndex({ enabled: 1, expiresAt: 1 });
  },
};
