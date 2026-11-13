const express = require('express');
const { z } = require('zod');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { searchNotes } = require('../controllers/searchController');

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const router = express.Router();
router.get('/', protect, validate({ query: z.object({
  q: z.string().trim().min(1).max(200),
  archived: z.enum(['true', 'false']).optional(),
  favorite: z.enum(['true', 'false']).optional(),
}) }), searchNotes);

module.exports = router;
