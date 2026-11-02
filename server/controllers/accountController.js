const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');
const UserNotePreference = require('../models/UserNotePreference');
const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');
const CollaborationState = require('../models/CollaborationState');
const CollaborationUpdate = require('../models/CollaborationUpdate');
const NoteRevision = require('../models/NoteRevision');
const PublicShare = require('../models/PublicShare');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Invitation = require('../models/Invitation');
const { evictDocument } = require('../services/collaborationService');

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
  await user.save();
  res.json({ message: 'Password changed successfully' });
});

const exportAccount = asyncHandler(async (req, res) => {
  const [workspaces, memberships, ownedNotes, permissions, preferences, comments] = await Promise.all([
    Workspace.find({ owner: req.user._id }).lean(),
    WorkspaceMembership.find({ user: req.user._id }).lean(),
    Note.find({ user: req.user._id }).lean(),
    SharePermission.find({ userId: req.user._id }).lean(),
    UserNotePreference.find({ user: req.user._id }).lean(),
    Comment.find({ author: req.user._id }).lean(),
  ]);
  res.setHeader('Content-Disposition', `attachment; filename="otion-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    profile: { _id: req.user._id, name: req.user.name, email: req.user.email, avatarUrl: req.user.avatarUrl, createdAt: req.user.createdAt },
    workspaces,
    memberships,
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
  const ownedWorkspaces = await Workspace.find({ owner: user._id }).distinct('_id');
  await Promise.all([
    CollaborationState.deleteMany({ note: { $in: noteIds } }),
    CollaborationUpdate.deleteMany({ note: { $in: noteIds } }),
    NoteRevision.deleteMany({ note: { $in: noteIds } }),
    PublicShare.deleteMany({ note: { $in: noteIds } }),
    Comment.deleteMany({ $or: [{ note: { $in: noteIds } }, { author: user._id }] }),
    Notification.deleteMany({ $or: [{ note: { $in: noteIds } }, { recipient: user._id }, { actor: user._id }] }),
    Invitation.deleteMany({ $or: [{ note: { $in: noteIds } }, { inviter: user._id }, { email: user.email }] }),
    SharePermission.deleteMany({ $or: [{ noteId: { $in: noteIds } }, { userId: user._id }] }),
    UserNotePreference.deleteMany({ $or: [{ note: { $in: noteIds } }, { user: user._id }] }),
    WorkspaceMembership.deleteMany({ $or: [{ workspace: { $in: ownedWorkspaces } }, { user: user._id }] }),
    Workspace.deleteMany({ _id: { $in: ownedWorkspaces } }),
    Note.deleteMany({ _id: { $in: noteIds } }),
  ]);
  await user.deleteOne();
  req.app.get('io')?.disconnectUser(user._id);
  res.json({ message: 'Account deleted' });
});

module.exports = { changePassword, deleteAccount, exportAccount, profile };
