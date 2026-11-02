const mongoose = require('mongoose');

const sharePermissionSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'viewer' },
  },
  { timestamps: true },
);

sharePermissionSchema.index({ noteId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('SharePermission', sharePermissionSchema);
