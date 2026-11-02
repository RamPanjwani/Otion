const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    icon: { type: String, default: '◇', maxlength: 16 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    settings: {
      allowMemberInvites: { type: Boolean, default: false },
      defaultNoteRole: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
    },
  },
  { timestamps: true },
);

workspaceSchema.index({ owner: 1, createdAt: 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
