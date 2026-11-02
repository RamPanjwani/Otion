const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');

const noteSummary = (note) => ({
  _id: note._id,
  title: note.title,
  icon: note.icon,
  coverImage: note.coverImage,
  parentDocument: note.parentDocument,
  isArchived: note.isArchived,
  isPublished: note.isPublished,
  isFavorite: note.isFavorite,
  updatedAt: note.updatedAt,
  user: note.user?._id || note.user,
});

const noteAudience = async (note) => {
  const sharedUsers = await SharePermission.find({ noteId: note._id }).distinct('userId');
  return [String(note.user?._id || note.user), ...sharedUsers.map(String)];
};

const emitNoteSync = async (req, note) => {
  const io = req.app.get('io');
  if (!io) return;
  const summary = noteSummary(note);
  const audience = await noteAudience(note);
  audience.forEach((userId) => io.to(`user:${userId}`).emit('note-sync', { note: summary }));
};

const emitNoteRemoval = async (req, note) => {
  const io = req.app.get('io');
  if (!io) return;
  const audience = await noteAudience(note);
  audience.forEach((userId) => io.to(`user:${userId}`).emit('note-remove', { noteId: String(note._id) }));
};

const ensureId = (id, res, conceal = false) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(conceal ? 404 : 400);
    throw new Error(conceal ? 'Page not found' : 'Invalid note id');
  }
};

const accessFor = async (note, userId) => {
  if (userId && note.user.equals(userId)) return 'owner';
  const permission = userId ? await SharePermission.findOne({ noteId: note._id, userId }) : null;
  return permission?.role || (note.isPublished ? 'viewer' : null);
};

const requireNote = async (id, userId, res, roles = ['owner', 'editor', 'viewer'], conceal = false) => {
  ensureId(id, res, conceal);
  const note = await Note.findById(id).populate('user', 'name email avatarUrl');
  if (!note) {
    res.status(404);
    throw new Error(conceal ? 'Page not found' : 'Note not found');
  }
  const role = await accessFor(note, userId);
  if (!role || !roles.includes(role)) {
    res.status(conceal ? 404 : 403);
    throw new Error(conceal ? 'Page not found' : 'You do not have permission to access this note');
  }
  return { note, role };
};

const listNotes = asyncHandler(async (req, res) => {
  const archived = req.query.archived === 'true';
  const shared = archived
    ? []
    : await SharePermission.find({ userId: req.user._id }).distinct('noteId');
  const ownership = archived
    ? { user: req.user._id }
    : { $or: [{ user: req.user._id }, { _id: { $in: shared } }] };
  const notes = await Note.find({ ...ownership, isArchived: archived })
    .sort({ updatedAt: -1 })
    .populate('user', 'name email avatarUrl');
  res.json(notes);
});

const createNote = asyncHandler(async (req, res) => {
  const note = await Note.create({
    title: String(req.body.title || 'Untitled').trim() || 'Untitled',
    parentDocument: req.body.parentDocument || null,
    user: req.user._id,
    content: Array.isArray(req.body.content) ? req.body.content : [],
  });
  await emitNoteSync(req, note);
  res.status(201).json(note);
});

const getNote = asyncHandler(async (req, res) => {
  const { note, role } = await requireNote(req.params.id, req.user?._id, res, ['owner', 'editor', 'viewer'], true);
  res.json({ ...note.toObject(), accessRole: role });
});

const getPublicNote = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404);
    throw new Error('Page not found');
  }
  const note = await Note.findOne({ _id: req.params.id, isPublished: true, isArchived: false })
    .select('title content icon coverImage updatedAt');
  if (!note) {
    res.status(404);
    throw new Error('Page not found');
  }
  res.json(note);
});

const updateNote = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor']);
  ['title', 'content', 'icon', 'coverImage', 'parentDocument', 'isFavorite'].forEach((field) => {
    if (req.body[field] !== undefined) note[field] = req.body[field];
  });
  await note.save();
  req.app.get('io')?.to(`note:${note._id}`).emit('document-saved', {
    document: {
      title: note.title,
      content: note.content,
      icon: note.icon,
      coverImage: note.coverImage,
      isFavorite: note.isFavorite,
      updatedAt: note.updatedAt,
    },
  });
  await emitNoteSync(req, note);
  res.json(note);
});

const setArchived = (isArchived) => asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner']);
  note.isArchived = isArchived;
  await note.save();
  await emitNoteSync(req, note);
  res.json(note);
});

const deleteNote = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner']);
  await emitNoteRemoval(req, note);
  await Promise.all([
    SharePermission.deleteMany({ noteId: note._id }),
    note.deleteOne(),
  ]);
  res.json({ message: 'Note permanently deleted' });
});

module.exports = {
  listNotes,
  createNote,
  getNote,
  getPublicNote,
  updateNote,
  archiveNote: setArchived(true),
  restoreNote: setArchived(false),
  deleteNote,
  requireNote,
};
