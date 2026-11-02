const mongoose = require('mongoose');

const publicShareSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, unique: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null, index: true },
    passwordHash: { type: String, default: null, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PublicShare', publicShareSchema);
