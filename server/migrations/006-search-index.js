module.exports = {
  id: '006-search-index',
  description: 'Create the fallback note title and block-text search index',
  async up({ mongoose, dryRun }) {
    if (dryRun) {
      console.log('would create the note_content_search text index');
      return;
    }
    await mongoose.connection.collection('notes').createIndex(
      { title: 'text', 'content.text': 'text' },
      { name: 'note_content_search' },
    );
  },
};
