const mongoose = require('mongoose');

const workspaceMembershipSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'guest'], required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

workspaceMembershipSchema.index({ workspace: 1, user: 1 }, { unique: true });
workspaceMembershipSchema.index({ user: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('WorkspaceMembership', workspaceMembershipSchema);
