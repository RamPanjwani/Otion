const mongoose = require('mongoose');

const userNotePreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    favorite: { type: Boolean, default: false },
    sortOrder: { type: Number, default: null },
    lastOpenedAt: { type: Date, default: null },
    sidebarExpanded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userNotePreferenceSchema.index({ user: 1, note: 1 }, { unique: true });
userNotePreferenceSchema.index({ user: 1, favorite: 1, updatedAt: -1 });
userNotePreferenceSchema.index({ user: 1, sortOrder: 1 });
userNotePreferenceSchema.index({ user: 1, lastOpenedAt: -1 });

module.exports = mongoose.model('UserNotePreference', userNotePreferenceSchema);
