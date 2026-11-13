const asyncHandler = require('express-async-handler');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const SharePermission = require('../models/SharePermission');
const User = require('../models/User');
const { requireNote } = require('./noteController');

const populateComment = (query) => query
  .populate('author', 'name email avatarUrl')
  .populate('resolvedBy', 'name');

const listComments = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.noteId, req.user._id, res, ['owner', 'editor', 'commenter', 'viewer'], true);
  const comments = await populateComment(Comment.find({ note: note._id }).sort({ createdAt: 1 }));
  res.json(comments);
});

const createComment = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.noteId, req.user._id, res, ['owner', 'editor', 'commenter', 'viewer'], true);
  const emails = [...new Set([...req.body.content.matchAll(/@([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g)].map((match) => match[1].toLowerCase()))];
  const mentionedUsers = emails.length ? await User.find({ email: { $in: emails } }).select('_id') : [];
  const sharedUsers = await SharePermission.find({ noteId: note._id }).distinct('userId');
  const audience = new Set([String(note.user._id || note.user), ...sharedUsers.map(String)]);
  const mentions = mentionedUsers.filter((user) => audience.has(String(user._id))).map((user) => user._id);
  let comment = await Comment.create({
    note: note._id,
    blockId: req.body.blockId || null,
    author: req.user._id,
    content: req.body.content,
    mentions,
  });
  comment = await populateComment(Comment.findById(comment._id));

  const recipients = new Map();
  if (String(note.user._id || note.user) !== String(req.user._id)) recipients.set(String(note.user._id || note.user), 'comment');
  mentions.forEach((userId) => { if (String(userId) !== String(req.user._id)) recipients.set(String(userId), 'mention'); });
  const notifications = await Notification.insertMany([...recipients].map(([recipient, type]) => ({
    recipient, type, actor: req.user._id, note: note._id, comment: comment._id,
  })));
  const io = req.app.get('io');
  io?.to(`note:${note._id}`).emit('comments-sync', { action: 'created', comment });
  notifications.forEach((notification) => io?.to(`user:${notification.recipient}`).emit('notification', { notificationId: notification._id }));
  res.status(201).json(comment);
});

const resolveComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }
  await requireNote(comment.note, req.user._id, res, ['owner', 'editor'], true);
  comment.resolved = req.body.resolved;
  comment.resolvedBy = req.body.resolved ? req.user._id : null;
  comment.resolvedAt = req.body.resolved ? new Date() : null;
  await comment.save();
  await comment.populate('author', 'name email avatarUrl');
  await comment.populate('resolvedBy', 'name');
  req.app.get('io')?.to(`note:${comment.note}`).emit('comments-sync', { action: 'updated', comment });
  res.json(comment);
});

module.exports = { createComment, listComments, resolveComment };
