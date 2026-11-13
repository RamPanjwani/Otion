const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401);
    const error = new Error('Authentication required');
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  try {
    const decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user || req.user.tokenVersion !== (decoded.version ?? 0)) {
      throw new Error('Session revoked or user no longer exists');
    }
    next();
  } catch (error) {
    res.status(401);
    const authError = new Error('Invalid or expired token', { cause: error });
    authError.code = 'INVALID_TOKEN';
    throw authError;
  }
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.tokenVersion === (decoded.version ?? 0)) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
});

module.exports = { protect, optionalAuth };
