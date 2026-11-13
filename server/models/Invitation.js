const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['editor', 'commenter', 'viewer'], default: 'viewer' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending', index: true },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

invitationSchema.index({ note: 1, email: 1, status: 1 });

module.exports = mongoose.model('Invitation', invitationSchema);
