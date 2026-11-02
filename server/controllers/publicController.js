const asyncHandler = require('express-async-handler');
const { createHash } = require('node:crypto');
const PublicShare = require('../models/PublicShare');
const Note = require('../models/Note');
const bcrypt = require('bcryptjs');

const findShare = async (token, res) => {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const share = await PublicShare.findOne({
    tokenHash,
    enabled: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).select('+passwordHash note');
  if (!share) {
    res.status(404);
    throw new Error('Note not found');
  }
  return share;
};

const readNote = async (share, res) => {
  const note = await Note.findOne({ _id: share.note, isPublished: true, isArchived: false }).select('title content icon updatedAt');
  if (!note) {
    res.status(404);
    throw new Error('Note not found');
  }
  return note;
};

const getPublicNote = asyncHandler(async (req, res) => {
  const share = await findShare(req.params.token, res);
  if (share.passwordHash) {
    return res.status(401).json({ message: 'Password required', error: { code: 'PASSWORD_REQUIRED', message: 'Password required', requestId: req.id } });
  }
  res.json(await readNote(share, res));
});

const unlockPublicNote = asyncHandler(async (req, res) => {
  const share = await findShare(req.params.token, res);
  if (!share.passwordHash || !await bcrypt.compare(req.body.password, share.passwordHash)) {
    res.status(401);
    throw new Error('Password is invalid');
  }
  res.json(await readNote(share, res));
});

module.exports = { getPublicNote, unlockPublicNote };
