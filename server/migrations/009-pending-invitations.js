module.exports = {
  id: '009-pending-invitations',
  description: 'Create secure pending invitation indexes',
  async up({ mongoose, dryRun }) {
    if (dryRun) {
      console.log('would create pending invitation indexes');
      return;
    }
    const invitations = mongoose.connection.collection('invitations');
    await invitations.createIndex({ tokenHash: 1 }, { unique: true });
    await invitations.createIndex({ note: 1, email: 1, status: 1 });
    await invitations.createIndex({ expiresAt: 1 });
  },
};
