const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/security');
const { auth } = require('../validation/schemas');
const { changePassword, deleteAccount, exportAccount, profile } = require('../controllers/accountController');

const router = express.Router();
router.post('/register', authLimiter, validate({ body: auth.register }), register);
router.post('/login', authLimiter, validate({ body: auth.login }), login);
router.get('/me', protect, me);
router.patch('/profile', protect, validate({ body: auth.profile }), profile);
router.patch('/password', protect, authLimiter, validate({ body: auth.changePassword }), changePassword);
router.get('/export', protect, exportAccount);
router.delete('/account', protect, authLimiter, validate({ body: auth.deleteAccount }), deleteAccount);

module.exports = router;
