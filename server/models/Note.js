const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Untitled', trim: true },
    content: { type: [mongoose.Schema.Types.Mixed], default: [] },
    icon: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
    isArchived: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Note', noteSchema);
