const jwt = require('jsonwebtoken');

const generateToken = (userId, version = 0) =>
  jwt.sign({ id: userId, version }, process.env.JWT_SECRET, { expiresIn: '30d' });

module.exports = generateToken;
