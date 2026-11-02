const express = require('express');
const { z } = require('zod');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { listNotifications, markRead } = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);
router.get('/', listNotifications);
router.patch('/:id/read', validate({ params: z.object({ id: z.union([z.literal('all'), z.string().regex(/^[a-f\d]{24}$/i)]) }) }), markRead);

module.exports = router;
