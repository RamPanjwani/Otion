const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { ensurePersonalWorkspace } = require('../services/workspaceService');
const { createHash } = require('node:crypto');
const Invitation = require('../models/Invitation');
const SharePermission = require('../models/SharePermission');
const WorkspaceMembership = require('../models/WorkspaceMembership');

const serializeUser = (user, includeToken = false) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  ...(includeToken ? { token: generateToken(user._id) } : {}),
});

const register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || password.length < 8) {
    res.status(400);
    throw new Error('Name, email, and a password of at least 8 characters are required');
  }
  if (await User.exists({ email })) {
    res.status(400);
    throw new Error('An account with this email already exists');
  }
  let invitation = null;
  if (req.body.invitationToken) {
    const tokenHash = createHash('sha256').update(req.body.invitationToken).digest('hex');
    invitation = await Invitation.findOne({ tokenHash, status: 'pending', expiresAt: { $gt: new Date() } });
    if (!invitation || invitation.email !== email) {
      res.status(400);
      throw new Error('Invitation is invalid, expired, or belongs to another email address');
    }
  }
  const user = await User.create({ name, email, password });
  await ensurePersonalWorkspace(user);
  if (invitation) {
    await SharePermission.findOneAndUpdate(
      { noteId: invitation.note, userId: user._id },
      { role: invitation.role },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    if (invitation.workspace) {
      await WorkspaceMembership.findOneAndUpdate(
        { workspace: invitation.workspace, user: user._id },
        { $setOnInsert: { role: 'guest', status: 'active', joinedAt: new Date() } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }
    invitation.status = 'accepted';
    invitation.acceptedBy = user._id;
    invitation.acceptedAt = new Date();
    await invitation.save();
  }
  res.status(201).json(serializeUser(user, true));
});

const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }
  res.json(serializeUser(user, true));
});

const me = asyncHandler(async (req, res) => res.json(serializeUser(req.user)));

module.exports = { register, login, me };
