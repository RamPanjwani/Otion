const asyncHandler = require('express-async-handler');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');
const UserNotePreference = require('../models/UserNotePreference');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchNotes = asyncHandler(async (req, res) => {
  const { q, workspaceId, archived = 'false', favorite } = req.validatedQuery;
  const shared = archived === 'true' ? [] : await SharePermission.find({ userId: req.user._id }).distinct('noteId');
  const accessible = archived === 'true'
    ? { user: req.user._id }
    : { $or: [{ user: req.user._id }, { _id: { $in: shared } }] };
  const filter = { ...accessible, isArchived: archived === 'true' };
  if (workspaceId) filter.workspace = workspaceId;
  if (favorite === 'true') {
    filter._id = { $in: await UserNotePreference.find({ user: req.user._id, favorite: true }).distinct('note') };
  }
  const matcher = new RegExp(escapeRegex(q), 'i');
  filter.$and = [{ $or: [{ title: matcher }, { 'content.text': matcher }] }];

  const notes = await Note.find(filter).sort({ updatedAt: -1 }).limit(50).populate('user', 'name email avatarUrl');
  const preferences = await UserNotePreference.find({ user: req.user._id, note: { $in: notes.map((note) => note._id) } });
  const preferenceByNote = new Map(preferences.map((item) => [String(item.note), item]));
  const needle = q.toLocaleLowerCase();
  res.json(notes.map((note) => {
    const matchingBlock = note.content.find((block) => String(block.text || '').toLocaleLowerCase().includes(needle));
    const text = String(matchingBlock?.text || '');
    const offset = Math.max(0, text.toLocaleLowerCase().indexOf(needle) - 45);
    return {
      ...note.toObject(),
      isFavorite: Boolean(preferenceByNote.get(String(note._id))?.favorite),
      matchPreview: text ? text.slice(offset, offset + 140) : '',
    };
  }));
});

module.exports = { searchNotes };
