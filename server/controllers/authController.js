const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { createHash, randomBytes } = require('node:crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const Invitation = require('../models/Invitation');
const SharePermission = require('../models/SharePermission');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../services/emailService');
const { runTransaction } = require('../utils/runTransaction');

const serializeUser = (user, includeToken = false) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  isEmailVerified: Boolean(user.isEmailVerified),
  ...(includeToken ? { token: generateToken(user._id, user.tokenVersion ?? 0) } : {}),
});

const getClientBase = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');

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

  const isTest = process.env.NODE_ENV === 'test';
  const rawVerifyToken = randomBytes(32).toString('base64url');
  const emailVerificationTokenHash = createHash('sha256').update(rawVerifyToken).digest('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await runTransaction(async (session) => {
    const opts = session ? { session } : {};
    const createdUsers = await User.create(
      [
        {
          name,
          email,
          password,
          isEmailVerified: false,
          emailVerificationTokenHash,
          emailVerificationExpires,
        },
      ],
      opts,
    );
    const created = createdUsers[0];

    if (invitation) {
      await SharePermission.findOneAndUpdate(
        { noteId: invitation.note, userId: created._id },
        { role: invitation.role },
        { upsert: true, returnDocument: 'after', runValidators: true, ...opts },
      );
      invitation.status = 'accepted';
      invitation.acceptedBy = created._id;
      invitation.acceptedAt = new Date();
      await invitation.save(opts);
    }
    return created;
  });

  // Graceful mode: dispatch verification email in background and log in user immediately
  const verifyUrl = `${getClientBase()}/verify-email?token=${encodeURIComponent(rawVerifyToken)}`;
  sendVerificationEmail({
    to: email,
    userName: name,
    verifyUrl,
  }).catch(() => undefined);

  res.status(201).json({
    ...serializeUser(user, true),
    message: 'Account created. Please check your email to verify your account.',
    ...(isTest ? { verifyToken: rawVerifyToken } : {}),
  });
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

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });

  // Generic message always returned to avoid email enumeration
  if (!user) {
    return res.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  }

  const rawResetToken = randomBytes(32).toString('base64url');
  user.resetPasswordTokenHash = createHash('sha256').update(rawResetToken).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const resetUrl = `${getClientBase()}/reset-password?token=${encodeURIComponent(rawResetToken)}`;
  sendPasswordResetEmail({
    to: user.email,
    userName: user.name,
    resetUrl,
  }).catch(() => undefined);

  res.json({
    message: 'If an account exists with that email, a password reset link has been sent.',
    ...(process.env.NODE_ENV === 'test' ? { resetToken: rawResetToken } : {}),
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    res.status(400);
    throw new Error('Password reset token is invalid or has expired');
  }

  user.password = password;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpires = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior sessions
  await user.save();

  req.app.get('io')?.disconnectUser(user._id);

  res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.' });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    res.status(400);
    throw new Error('Verification link is invalid or has expired');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({
    message: 'Email verified successfully. You can now sign in to your account.',
    ...serializeUser(user, true),
  });
});

const resendVerification = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });

  if (!user || user.isEmailVerified) {
    return res.json({
      message: 'If an unverified account exists with that email, a verification link has been sent.',
    });
  }

  const isTest = process.env.NODE_ENV === 'test';
  const rawVerifyToken = randomBytes(32).toString('base64url');
  user.emailVerificationTokenHash = createHash('sha256').update(rawVerifyToken).digest('hex');
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const verifyUrl = `${getClientBase()}/verify-email?token=${encodeURIComponent(rawVerifyToken)}`;
  sendVerificationEmail({
    to: user.email,
    userName: user.name,
    verifyUrl,
  }).catch(() => undefined);

  res.json({
    message: 'If an unverified account exists with that email, a verification link has been sent.',
    ...(process.env.NODE_ENV === 'test' ? { verifyToken: rawVerifyToken } : {}),
  });
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  req.app.get('io')?.disconnectUser(req.user._id);
  res.json({ message: 'Logged out successfully' });
});

const me = asyncHandler(async (req, res) => res.json(serializeUser(req.user)));

module.exports = {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
};
