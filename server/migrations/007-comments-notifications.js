module.exports = {
  id: '007-comments-notifications',
  description: 'Create comment and notification indexes',
  async up({ mongoose, dryRun }) {
    if (dryRun) {
      console.log('would create comment and notification indexes');
      return;
    }
    const comments = mongoose.connection.collection('comments');
    await comments.createIndex({ note: 1, createdAt: 1 });
    await comments.createIndex({ parentComment: 1 });
    const notifications = mongoose.connection.collection('notifications');
    await notifications.createIndex({ recipient: 1, readAt: 1, createdAt: -1 });
  },
};
