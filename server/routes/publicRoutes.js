const express = require('express');
const { z } = require('zod');
const { getPublicNote, unlockPublicNote } = require('../controllers/publicController');
const { validate } = require('../middleware/validate');
const { publicUnlockLimiter } = require('../middleware/security');

const router = express.Router();
router.get('/:token', getPublicNote);
router.post('/:token/unlock', publicUnlockLimiter, validate({ body: z.object({ password: z.string().min(1).max(128) }) }), unlockPublicNote);

module.exports = router;
