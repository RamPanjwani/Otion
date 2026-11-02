const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');

module.exports = {
  id: '001-note-indexes-and-favorites',
  description: 'Backfill favorite state and create note/share query indexes',
  async up({ dryRun }) {
    if (dryRun) {
      const missingFavorites = await Note.countDocuments({ isFavorite: { $exists: false } });
      console.log(`would backfill ${missingFavorites} notes`);
      return;
    }
    await Note.updateMany({ isFavorite: { $exists: false } }, { $set: { isFavorite: false } });
    await Promise.all([Note.createIndexes(), SharePermission.createIndexes()]);
  },
};
