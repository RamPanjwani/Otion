const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');
const PublicShare = require('../models/PublicShare');
const { createHash, randomBytes } = require('node:crypto');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const Invitation = require('../models/Invitation');
const { sendInvitationEmail, sendCollaboratorEmail } = require('../services/emailService');

const ownerNote = async (noteId, userId, res) => {
  const note = await Note.findOne({ _id: noteId, user: userId });
  if (!note) {
    res.status(403);
    throw new Error('Only the note owner can manage access');
  }
  return note;
};

const searchUsers = asyncHandler(async (req, res) => {
  const query = req.validatedQuery.q;
  if (query.length < 2) return res.json([]);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(escaped, 'i');
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ email: matcher }, { name: matcher }],
  })
    .select('name email avatarUrl')
    .sort({ email: 1 })
    .limit(8);
  res.json(users);
});

const invite = asyncHandler(async (req, res) => {
  const note = await ownerNote(req.params.noteId, req.user._id, res);
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = ['editor', 'commenter'].includes(req.body.role) ? req.body.role : 'viewer';
  const user = await User.findOne({ email });
  const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
  if (!user) {
    const invitationToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(invitationToken).digest('hex');
    const invitation = await Invitation.findOneAndUpdate(
      { note: note._id, email, status: 'pending' },
      {
        inviter: req.user._id,
        role,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    const inviteUrl = `${clientBase}/register?invite=${encodeURIComponent(invitationToken)}&email=${encodeURIComponent(email)}`;
    sendInvitationEmail({
      to: email,
      inviterName: req.user.name,
      noteTitle: note.title,
      inviteUrl,
      role,
    }).catch(() => undefined);

    return res.status(202).json({
      pending: true,
      invitation: { _id: invitation._id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
      invitationToken,
    });
  }
  if (user._id.equals(req.user._id)) {
    res.status(400);
    throw new Error('The owner already has access');
  }
  const permission = await SharePermission.findOneAndUpdate(
    { noteId: req.params.noteId, userId: user._id },
    { role },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).populate('userId', 'name email avatarUrl');

  const noteUrl = `${clientBase}/notes/${note._id}`;
  sendCollaboratorEmail({
    to: email,
    inviterName: req.user.name,
    noteTitle: note.title,
    noteUrl,
    role,
    isUpdate: false,
  }).catch(() => undefined);

  req.app.get('io')?.notifyUserRole(req.params.noteId, user._id, role);
  req.app.get('io')?.to(`user:${user._id}`).emit('note-sync', {
    note: {
      _id: note._id,
      title: note.title,
      icon: note.icon,
      isArchived: note.isArchived,
      isPublished: note.isPublished,
      isFavorite: false,
      updatedAt: note.updatedAt,
      user: note.user,
    },
  });
  const notification = await Notification.create({ recipient: user._id, type: 'share', actor: req.user._id, note: note._id });
  req.app.get('io')?.to(`user:${user._id}`).emit('notification', { notificationId: notification._id });
  res.status(201).json(permission);
});

const updateRole = asyncHandler(async (req, res) => {
  const note = await ownerNote(req.params.noteId, req.user._id, res);
  const role = req.body.role;
  if (!['editor', 'commenter', 'viewer'].includes(role)) {
    res.status(400);
    throw new Error('Role must be editor, commenter, or viewer');
  }
  const permission = await SharePermission.findOneAndUpdate(
    { noteId: req.params.noteId, userId: req.params.userId },
    { role },
    { returnDocument: 'after', runValidators: true },
  ).populate('userId', 'name email avatarUrl');
  if (!permission) {
    res.status(404);
    throw new Error('Collaborator not found');
  }
  req.app.get('io')?.notifyUserRole(req.params.noteId, req.params.userId, role);

  if (permission.userId?.email) {
    const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
    const noteUrl = `${clientBase}/notes/${note._id}`;
    sendCollaboratorEmail({
      to: permission.userId.email,
      inviterName: req.user.name,
      noteTitle: note.title,
      noteUrl,
      role,
      isUpdate: true,
    }).catch(() => undefined);
  }

  res.json(permission);
});

const collaborators = asyncHandler(async (req, res) => {
  const note = await ownerNote(req.params.noteId, req.user._id, res);
  const permissions = await SharePermission.find({ noteId: note._id })
    .populate('userId', 'name email avatarUrl')
    .sort({ createdAt: 1 });
  const owner = await User.findById(note.user).select('name email avatarUrl');
  const publicShare = await PublicShare.exists({ note: note._id, enabled: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  const pendingInvitations = await Invitation.find({ note: note._id, status: 'pending', expiresAt: { $gt: new Date() } })
    .select('email role expiresAt createdAt')
    .sort({ createdAt: 1 });
  res.json({ owner, collaborators: permissions, pendingInvitations, isPublished: Boolean(publicShare) });
});

const revokeInvitation = asyncHandler(async (req, res) => {
  await ownerNote(req.params.noteId, req.user._id, res);
  const invitation = await Invitation.findOneAndUpdate(
    { _id: req.params.invitationId, note: req.params.noteId, status: 'pending' },
    { status: 'revoked' },
    { returnDocument: 'after' },
  );
  if (!invitation) {
    res.status(404);
    throw new Error('Invitation not found');
  }
  res.json({ message: 'Invitation revoked' });
});

const revoke = asyncHandler(async (req, res) => {
  await ownerNote(req.params.noteId, req.user._id, res);
  await SharePermission.deleteOne({ noteId: req.params.noteId, userId: req.params.userId });
  req.app.get('io')?.to(`user:${req.params.userId}`).emit('note-remove', { noteId: req.params.noteId });
  req.app.get('io')?.evictUserFromNote(req.params.noteId, req.params.userId);
  res.json({ message: 'Access revoked' });
});

const setPublic = asyncHandler(async (req, res) => {
  const note = await ownerNote(req.params.noteId, req.user._id, res);
  note.isPublished = typeof req.body.isPublished === 'boolean'
    ? req.body.isPublished
    : !note.isPublished;
  await note.save();
  if (!note.isPublished) {
    await PublicShare.updateOne({ note: note._id }, { enabled: false });
    await req.app.get('io')?.revalidateNoteAccess(req.params.noteId);
    return res.json({ isPublished: false });
  }
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  if (expiresAt && expiresAt <= new Date()) {
    res.status(400);
    throw new Error('Public link expiration must be in the future');
  }
  const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 12) : null;
  await PublicShare.findOneAndUpdate(
    { note: note._id },
    { tokenHash, enabled: true, expiresAt, passwordHash, createdBy: req.user._id },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  res.json({ isPublished: true, token });
});

module.exports = { searchUsers, invite, collaborators, updateRole, revoke, revokeInvitation, setPublic };
