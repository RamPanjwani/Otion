const mongoose = require('mongoose');

const noteRevisionSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    revisionNumber: { type: Number, required: true },
    snapshot: {
      title: { type: String, default: 'Untitled' },
      content: { type: [mongoose.Schema.Types.Mixed], default: [] },
      icon: { type: String, default: '' },
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ['initial', 'automatic', 'manual', 'restore'], default: 'automatic' },
    name: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true },
);

noteRevisionSchema.index({ note: 1, revisionNumber: -1 }, { unique: true });
noteRevisionSchema.index({ note: 1, createdAt: -1 });

module.exports = mongoose.model('NoteRevision', noteRevisionSchema);
