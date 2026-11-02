const mongoose = require('mongoose');

const collaborationUpdateSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    sequence: { type: Number, required: true },
    update: { type: Buffer, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

collaborationUpdateSchema.index({ note: 1, sequence: 1 }, { unique: true });
collaborationUpdateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('CollaborationUpdate', collaborationUpdateSchema);
