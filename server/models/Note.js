const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Untitled', trim: true },
    content: { type: [mongoose.Schema.Types.Mixed], default: [] },
    contentSchemaVersion: { type: Number, default: 1 },
    revisionCounter: { type: Number, default: 0 },
    icon: { type: String, default: '📝' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

noteSchema.index({ user: 1, isArchived: 1, updatedAt: -1 });
noteSchema.index({ workspace: 1, isArchived: 1, updatedAt: -1 });
noteSchema.index({ isPublished: 1, isArchived: 1 });
noteSchema.index({ title: 'text', 'content.text': 'text' }, { name: 'note_content_search' });

module.exports = mongoose.model('Note', noteSchema);
