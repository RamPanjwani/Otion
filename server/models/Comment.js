const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    blockId: { type: String, default: null, maxlength: 100 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

commentSchema.index({ note: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
