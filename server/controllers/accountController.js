const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');
const UserNotePreference = require('../models/UserNotePreference');
const CollaborationState = require('../models/CollaborationState');
const CollaborationUpdate = require('../models/CollaborationUpdate');
const NoteRevision = require('../models/NoteRevision');
const PublicShare = require('../models/PublicShare');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Invitation = require('../models/Invitation');
const { evictDocument } = require('../services/collaborationService');
const { runTransaction } = require('../utils/runTransaction');

const profile = asyncHandler(async (req, res) => {
  req.user.name = req.body.name ?? req.user.name;
  req.user.avatarUrl = req.body.avatarUrl ?? req.user.avatarUrl;
  await req.user.save();
  res.json({ _id: req.user._id, name: req.user.name, email: req.user.email, avatarUrl: req.user.avatarUrl });
});

const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!await user.matchPassword(req.body.currentPassword)) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }
  user.password = req.body.newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  req.app.get('io')?.disconnectUser(user._id);
  res.json({ message: 'Password changed successfully' });
});

const exportAccount = asyncHandler(async (req, res) => {
  const [ownedNotes, permissions, preferences, comments] = await Promise.all([
    Note.find({ user: req.user._id }).lean(),
    SharePermission.find({ userId: req.user._id }).lean(),
    UserNotePreference.find({ user: req.user._id }).lean(),
    Comment.find({ author: req.user._id }).lean(),
  ]);
  res.setHeader('Content-Disposition', `attachment; filename="otion-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    profile: { _id: req.user._id, name: req.user.name, email: req.user.email, avatarUrl: req.user.avatarUrl, createdAt: req.user.createdAt },
    notes: ownedNotes,
    sharedPermissions: permissions,
    preferences,
    authoredComments: comments,
  });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !await user.matchPassword(req.body.password)) {
    res.status(401);
    throw new Error('Password is incorrect');
  }
  const ownedNotes = await Note.find({ user: user._id }).select('_id');
  const noteIds = ownedNotes.map((note) => note._id);
  const collaborators = await SharePermission.find({ noteId: { $in: noteIds } }).lean();
  collaborators.forEach((permission) => req.app.get('io')?.to(`user:${permission.userId}`).emit('note-remove', { noteId: String(permission.noteId) }));
  noteIds.forEach((noteId) => evictDocument(noteId));

  await runTransaction(async (session) => {
    const opts = session ? { session } : {};
    await CollaborationState.deleteMany({ note: { $in: noteIds } }, opts);
    await CollaborationUpdate.deleteMany({ note: { $in: noteIds } }, opts);
    await NoteRevision.deleteMany({ note: { $in: noteIds } }, opts);
    await PublicShare.deleteMany({ note: { $in: noteIds } }, opts);
    await Comment.deleteMany({ $or: [{ note: { $in: noteIds } }, { author: user._id }] }, opts);
    await Notification.deleteMany({ $or: [{ note: { $in: noteIds } }, { recipient: user._id }, { actor: user._id }] }, opts);
    await Invitation.deleteMany({ $or: [{ note: { $in: noteIds } }, { inviter: user._id }, { email: user.email }] }, opts);
    await SharePermission.deleteMany({ $or: [{ noteId: { $in: noteIds } }, { userId: user._id }] }, opts);
    await UserNotePreference.deleteMany({ $or: [{ note: { $in: noteIds } }, { user: user._id }] }, opts);
    await Note.deleteMany({ _id: { $in: noteIds } }, opts);
    await user.deleteOne(opts);
  });

  req.app.get('io')?.disconnectUser(user._id);
  res.json({ message: 'Account deleted' });
});

module.exports = { changePassword, deleteAccount, exportAccount, profile };
