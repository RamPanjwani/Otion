const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

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
  const user = await User.create({ name, email, password });
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
