const express = require('express');
const {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} = require('../controllers/authController');
const { profile, changePassword, deleteAccount, exportAccount } = require('../controllers/accountController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { auth: authSchemas } = require('../validation/schemas');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

router.post('/register', authLimiter, validate({ body: authSchemas.register }), register);
router.post('/login', authLimiter, validate({ body: authSchemas.login }), login);
router.post('/logout', protect, logout);
router.post('/forgot-password', authLimiter, validate({ body: authSchemas.forgotPassword }), forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: authSchemas.resetPassword }), resetPassword);
router.post('/verify-email', authLimiter, validate({ body: authSchemas.verifyEmail }), verifyEmail);
router.post('/resend-verification', authLimiter, validate({ body: authSchemas.resendVerification }), resendVerification);
router.get('/me', protect, me);
router.patch('/profile', protect, validate({ body: authSchemas.profile }), profile);
router.patch('/password', protect, validate({ body: authSchemas.password }), changePassword);
router.delete('/account', protect, validate({ body: authSchemas.deleteAccount }), deleteAccount);
router.get('/export', protect, exportAccount);

module.exports = router;
