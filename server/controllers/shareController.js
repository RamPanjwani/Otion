const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');

const ownerNote = async (noteId, userId, res) => {
  const note = await Note.findOne({ _id: noteId, user: userId });
  if (!note) {
    res.status(403);
    throw new Error('Only the document owner can manage access');
  }
  return note;
};

const searchUsers = asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
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
  const role = req.body.role === 'editor' ? 'editor' : 'viewer';
  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('No Otion user exists with that email');
  }
  if (user._id.equals(req.user._id)) {
    res.status(400);
    throw new Error('The owner already has access');
  }
  const permission = await SharePermission.findOneAndUpdate(
    { noteId: req.params.noteId, userId: user._id },
    { role },
    { upsert: true, new: true, runValidators: true },
  ).populate('userId', 'name email avatarUrl');
  req.app.get('io')?.notifyUserRole(req.params.noteId, user._id, role);
  req.app.get('io')?.to(`user:${user._id}`).emit('note-sync', {
    note: {
      _id: note._id,
      title: note.title,
      icon: note.icon,
      coverImage: note.coverImage,
      parentDocument: note.parentDocument,
      isArchived: note.isArchived,
      isPublished: note.isPublished,
      isFavorite: note.isFavorite,
      updatedAt: note.updatedAt,
      user: note.user,
    },
  });
  res.status(201).json(permission);
});

const updateRole = asyncHandler(async (req, res) => {
  await ownerNote(req.params.noteId, req.user._id, res);
  const role = req.body.role;
  if (!['editor', 'viewer'].includes(role)) {
    res.status(400);
    throw new Error('Role must be editor or viewer');
  }
  const permission = await SharePermission.findOneAndUpdate(
    { noteId: req.params.noteId, userId: req.params.userId },
    { role },
    { new: true, runValidators: true },
  ).populate('userId', 'name email avatarUrl');
  if (!permission) {
    res.status(404);
    throw new Error('Collaborator not found');
  }
  req.app.get('io')?.notifyUserRole(req.params.noteId, req.params.userId, role);
  res.json(permission);
});

const collaborators = asyncHandler(async (req, res) => {
  const note = await ownerNote(req.params.noteId, req.user._id, res);
  const permissions = await SharePermission.find({ noteId: note._id })
    .populate('userId', 'name email avatarUrl')
    .sort({ createdAt: 1 });
  const owner = await User.findById(note.user).select('name email avatarUrl');
  res.json({ owner, collaborators: permissions, isPublished: note.isPublished });
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
  if (!note.isPublished) await req.app.get('io')?.revalidateNoteAccess(req.params.noteId);
  res.json({ isPublished: note.isPublished });
});

module.exports = { searchUsers, invite, collaborators, updateRole, revoke, setPublic };
