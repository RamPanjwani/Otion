const asyncHandler = require('express-async-handler');
const Note = require('../models/Note');
const SharePermission = require('../models/SharePermission');
const UserNotePreference = require('../models/UserNotePreference');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchNotes = asyncHandler(async (req, res) => {
  const { q, archived = 'false', favorite } = req.validatedQuery;
  const shared = archived === 'true' ? [] : await SharePermission.find({ userId: req.user._id }).distinct('noteId');
  const accessible = archived === 'true'
    ? { user: req.user._id }
    : { $or: [{ user: req.user._id }, { _id: { $in: shared } }] };
  const filter = { ...accessible, isArchived: archived === 'true' };

  if (favorite === 'true') {
    filter._id = { $in: await UserNotePreference.find({ user: req.user._id, favorite: true }).distinct('note') };
  }

  const escaped = escapeRegex(q);
  const matcher = new RegExp(escaped, 'i');
  filter.$and = [{ $or: [{ title: matcher }, { 'content.text': matcher }] }];

  const notes = await Note.find(filter)
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate('user', 'name email avatarUrl');

  const preferences = await UserNotePreference.find({ user: req.user._id, note: { $in: notes.map((note) => note._id) } });
  const preferenceByNote = new Map(preferences.map((item) => [String(item.note), item]));
  const needle = q.toLowerCase();

  // Score results: exact title match > title starts with > title contains > content match
  const scored = notes.map((note) => {
    const titleLower = (note.title || '').toLowerCase();
    let score = 0;
    if (titleLower === needle) score += 100;
    else if (titleLower.startsWith(needle)) score += 50;
    else if (titleLower.includes(needle)) score += 20;

    const matchingBlock = (note.content || []).find((block) =>
      String(block.text || '').toLowerCase().includes(needle)
    );
    if (matchingBlock) score += 10;

    const text = String(matchingBlock?.text || '');
    const idx = text.toLowerCase().indexOf(needle);
    const offset = Math.max(0, idx - 40);
    const matchPreview = text ? text.slice(offset, offset + 140) : '';

    return {
      note,
      score,
      isFavorite: Boolean(preferenceByNote.get(String(note._id))?.favorite),
      matchPreview,
    };
  });

  scored.sort((a, b) => b.score - a.score || new Date(b.note.updatedAt) - new Date(a.note.updatedAt));

  res.json(scored.map((item) => ({
    ...item.note.toObject(),
    isFavorite: item.isFavorite,
    matchPreview: item.matchPreview,
  })));
});

module.exports = { searchNotes };
