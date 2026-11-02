const Note = require('../models/Note');
const NoteRevision = require('../models/NoteRevision');

const AUTOMATIC_INTERVAL_MS = 5 * 60 * 1000;

const recordRevision = async (note, author, reason = 'automatic', name = '') => {
  if (reason === 'automatic') {
    const latest = await NoteRevision.findOne({ note: note._id }).sort({ createdAt: -1 }).select('createdAt');
    if (latest && Date.now() - latest.createdAt.getTime() < AUTOMATIC_INTERVAL_MS) return latest;
  }
  const numbered = await Note.findByIdAndUpdate(
    note._id,
    { $inc: { revisionCounter: 1 } },
    { returnDocument: 'after' },
  ).select('revisionCounter');
  return NoteRevision.create({
    note: note._id,
    revisionNumber: numbered.revisionCounter,
    snapshot: { title: note.title, content: note.content, icon: note.icon },
    author,
    reason,
    name,
  });
};

module.exports = { recordRevision };
