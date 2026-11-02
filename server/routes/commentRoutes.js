const express = require('express');
const { z } = require('zod');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { createComment, listComments, resolveComment } = require('../controllers/commentController');

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const router = express.Router();
router.use(protect);
router.route('/note/:noteId')
  .get(validate({ params: z.object({ noteId: objectId }) }), listComments)
  .post(validate({
    params: z.object({ noteId: objectId }),
    body: z.object({
      content: z.string().trim().min(1).max(5000),
      blockId: z.string().max(100).nullable().optional(),
      parentComment: objectId.nullable().optional(),
    }),
  }), createComment);
router.patch('/:id/resolve', validate({ params: z.object({ id: objectId }), body: z.object({ resolved: z.boolean() }) }), resolveComment);

module.exports = router;
