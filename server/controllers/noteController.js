const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
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
const { ensurePersonalWorkspace, requireWorkspaceMembership } = require('../services/workspaceService');
const { evictDocument, replaceContent } = require('../services/collaborationService');
const { recordRevision } = require('../services/revisionService');

const noteSummary = (note, preference) => ({
  _id: note._id,
  title: note.title,
  icon: note.icon,
  isArchived: note.isArchived,
  isPublished: note.isPublished,
  isFavorite: Boolean(preference?.favorite),
  sortOrder: Number.isFinite(preference?.sortOrder) ? preference.sortOrder : null,
  updatedAt: note.updatedAt,
  user: note.user?._id || note.user,
  workspace: note.workspace?._id || note.workspace,
});

const noteAudience = async (note) => {
  const sharedUsers = await SharePermission.find({ noteId: note._id }).distinct('userId');
  return [String(note.user?._id || note.user), ...sharedUsers.map(String)];
};

const emitNoteSync = async (req, note) => {
  const io = req.app.get('io');
  if (!io) return;
  const audience = await noteAudience(note);
  const preferences = await UserNotePreference.find({ note: note._id, user: { $in: audience } });
  const preferenceByUser = new Map(preferences.map((preference) => [String(preference.user), preference]));
  audience.forEach((userId) => io.to(`user:${userId}`).emit('note-sync', {
    note: noteSummary(note, preferenceByUser.get(userId)),
  }));
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
    throw new Error(conceal ? 'Note not found' : 'Invalid note id');
  }
};

const accessFor = async (note, userId) => {
  if (userId && note.user.equals(userId)) return 'owner';
  const permission = userId ? await SharePermission.findOne({ noteId: note._id, userId }) : null;
  return permission?.role || null;
};

const requireNote = async (id, userId, res, roles = ['owner', 'editor', 'commenter', 'viewer'], conceal = false) => {
  ensureId(id, res, conceal);
  const note = await Note.findById(id).populate('user', 'name email avatarUrl');
  if (!note) {
    res.status(404);
    throw new Error('Note not found');
  }
  const role = await accessFor(note, userId);
  if (!role || !roles.includes(role)) {
    res.status(conceal ? 404 : 403);
    throw new Error(conceal ? 'Note not found' : 'You do not have permission to access this note');
  }
  return { note, role };
};

const listNotes = asyncHandler(async (req, res) => {
  const archived = req.validatedQuery?.archived === 'true';
  const shared = archived
    ? []
    : await SharePermission.find({ userId: req.user._id }).distinct('noteId');
  const ownership = archived
    ? { user: req.user._id }
    : { $or: [{ user: req.user._id }, { _id: { $in: shared } }] };
  const notes = await Note.find({ ...ownership, isArchived: archived })
    .where(req.validatedQuery?.workspaceId ? { workspace: req.validatedQuery.workspaceId } : {})
    .sort({ updatedAt: -1 })
    .populate('user', 'name email avatarUrl');
  const preferences = await UserNotePreference.find({ user: req.user._id, note: { $in: notes.map((note) => note._id) } });
  const preferenceByNote = new Map(preferences.map((preference) => [String(preference.note), preference]));
  const result = notes.map((note) => ({
    ...note.toObject(),
    isFavorite: Boolean(preferenceByNote.get(String(note._id))?.favorite),
    sortOrder: Number.isFinite(preferenceByNote.get(String(note._id))?.sortOrder)
      ? preferenceByNote.get(String(note._id)).sortOrder
      : null,
    lastOpenedAt: preferenceByNote.get(String(note._id))?.lastOpenedAt || null,
  }));
  result.sort((a, b) => {
    const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder : -1;
    const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder : -1;
    return aOrder - bOrder || new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  res.json(result);
});

const createNote = asyncHandler(async (req, res) => {
  const workspace = req.body.workspace
    || (await ensurePersonalWorkspace(req.user))._id;
  const membership = await requireWorkspaceMembership(workspace, req.user._id, ['owner', 'admin', 'member']);
  if (!membership) {
    res.status(404);
    throw new Error('Workspace not found');
  }
  const note = await Note.create({
    title: String(req.body.title || 'Untitled note').trim() || 'Untitled note',
    icon: req.body.icon || '📝',
    user: req.user._id,
    workspace,
    content: Array.isArray(req.body.content) ? req.body.content : [],
  });
  await UserNotePreference.updateMany(
    { user: req.user._id, sortOrder: { $type: 'number' } },
    { $inc: { sortOrder: 1 } },
  );
  await UserNotePreference.findOneAndUpdate(
    { user: req.user._id, note: note._id },
    { $set: { sortOrder: 0 } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  await emitNoteSync(req, note);
  await recordRevision(note, req.user._id, 'initial');
  res.status(201).json({ ...note.toObject(), sortOrder: 0 });
});

const reorderNotes = asyncHandler(async (req, res) => {
  const noteIds = req.body.noteIds;
  const shared = await SharePermission.find({ userId: req.user._id, noteId: { $in: noteIds } }).distinct('noteId');
  const accessible = await Note.find({
    _id: { $in: noteIds },
    isArchived: false,
    $or: [{ user: req.user._id }, { _id: { $in: shared } }],
  }).distinct('_id');
  if (accessible.length !== noteIds.length) {
    res.status(404);
    throw new Error('One or more notes could not be found');
  }
  await UserNotePreference.bulkWrite(noteIds.map((noteId, sortOrder) => ({
    updateOne: {
      filter: { user: req.user._id, note: noteId },
      update: { $set: { sortOrder } },
      upsert: true,
    },
  })));
  req.app.get('io')?.to(`user:${req.user._id}`).emit('note-order', { noteIds });
  res.json({ noteIds });
});

const getNote = asyncHandler(async (req, res) => {
  const { note, role } = await requireNote(req.params.id, req.user?._id, res, ['owner', 'editor', 'commenter', 'viewer'], true);
  const preference = await UserNotePreference.findOneAndUpdate(
    { user: req.user._id, note: note._id },
    { $set: { lastOpenedAt: new Date() } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  res.json({ ...note.toObject(), accessRole: role, isFavorite: Boolean(preference.favorite) });
});

const getPublicNote = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404);
    throw new Error('Note not found');
  }
  const note = await Note.findOne({ _id: req.params.id, isPublished: true, isArchived: false })
    .select('title content icon updatedAt');
  if (!note) {
    res.status(404);
    throw new Error('Note not found');
  }
  res.json(note);
});

const updateNote = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor']);
  ['title', 'content', 'icon'].forEach((field) => {
    if (req.body[field] !== undefined) note[field] = req.body[field];
  });
  await note.save();
  await recordRevision(note, req.user._id, req.body.saveReason === 'manual' ? 'manual' : 'automatic');
  req.app.get('io')?.to(`note:${note._id}`).emit('document-saved', {
    document: {
      title: note.title,
      content: note.content,
      icon: note.icon,
      updatedAt: note.updatedAt,
    },
  });
  await emitNoteSync(req, note);
  res.json(note);
});

const listRevisions = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor', 'commenter', 'viewer'], true);
  const revisions = await NoteRevision.find({ note: note._id })
    .sort({ revisionNumber: -1 })
    .limit(100)
    .populate('author', 'name avatarUrl');
  res.json(revisions);
});

const createRevision = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor']);
  const revision = await recordRevision(note, req.user._id, 'manual', req.body.name || '');
  await revision.populate('author', 'name avatarUrl');
  res.status(201).json(revision);
});

const restoreRevision = asyncHandler(async (req, res) => {
  const { note, role } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor']);
  const revision = await NoteRevision.findOne({ _id: req.params.revisionId, note: note._id });
  if (!revision) {
    res.status(404);
    throw new Error('Revision not found');
  }
  await recordRevision(note, req.user._id, 'manual', 'Before restore');
  note.title = revision.snapshot.title;
  note.content = revision.snapshot.content;
  note.icon = revision.snapshot.icon;
  await note.save();
  const collaboration = await replaceContent(note._id, note.content, req.user._id);
  req.app.get('io')?.to(`note:${note._id}`).emit('collab-update', { update: collaboration.update, sequence: collaboration.sequence });
  req.app.get('io')?.to(`note:${note._id}`).emit('document-saved', {
    document: { title: note.title, content: note.content, icon: note.icon, updatedAt: note.updatedAt },
  });
  await recordRevision(note, req.user._id, 'restore', revision.name || `Revision ${revision.revisionNumber}`);
  await emitNoteSync(req, note);
  res.json({ ...note.toObject(), accessRole: role });
});

const updatePreference = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor', 'commenter', 'viewer'], true);
  const preference = await UserNotePreference.findOneAndUpdate(
    { user: req.user._id, note: note._id },
    { $set: req.body },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
  await emitNoteSync(req, note);
  res.json({
    favorite: preference.favorite,
    lastOpenedAt: preference.lastOpenedAt,
    sidebarExpanded: preference.sidebarExpanded,
  });
});

const setArchived = (isArchived) => asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner']);
  note.isArchived = isArchived;
  await note.save();
  await emitNoteSync(req, note);
  res.json(note);
});

const duplicateNote = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner', 'editor', 'commenter', 'viewer'], true);
  const membership = await requireWorkspaceMembership(note.workspace, req.user._id, ['owner', 'admin', 'member']);
  if (!membership) {
    res.status(403);
    throw new Error('You cannot create notes in this workspace');
  }
  const duplicate = await Note.create({
    title: `${note.title} copy`,
    content: note.content,
    icon: note.icon,
    user: req.user._id,
    workspace: note.workspace,
    contentSchemaVersion: 1,
  });
  await recordRevision(duplicate, req.user._id, 'initial');
  await emitNoteSync(req, duplicate);
  res.status(201).json(duplicate);
});

const deleteNote = asyncHandler(async (req, res) => {
  const { note } = await requireNote(req.params.id, req.user._id, res, ['owner']);
  await emitNoteRemoval(req, note);
  evictDocument(note._id);
  await Promise.all([
    SharePermission.deleteMany({ noteId: note._id }),
    UserNotePreference.deleteMany({ note: note._id }),
    CollaborationState.deleteOne({ note: note._id }),
    CollaborationUpdate.deleteMany({ note: note._id }),
    NoteRevision.deleteMany({ note: note._id }),
    PublicShare.deleteOne({ note: note._id }),
    Comment.deleteMany({ note: note._id }),
    Notification.deleteMany({ note: note._id }),
    Invitation.deleteMany({ note: note._id }),
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
  updatePreference,
  listRevisions,
  createRevision,
  restoreRevision,
  duplicateNote,
  reorderNotes,
  archiveNote: setArchived(true),
  restoreNote: setArchived(false),
  deleteNote,
  requireNote,
};
