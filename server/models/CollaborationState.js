const mongoose = require('mongoose');

const collaborationStateSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, unique: true, index: true },
    snapshot: { type: Buffer, required: true },
    schemaVersion: { type: Number, default: 2 },
    snapshotSequence: { type: Number, default: 0 },
    lastSequence: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('CollaborationState', collaborationStateSchema);
