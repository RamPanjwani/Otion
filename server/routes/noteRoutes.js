const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listNotes, createNote, getNote, updateNote, updatePreference, archiveNote, restoreNote, deleteNote,
  listRevisions, createRevision, restoreRevision,
  duplicateNote,
  reorderNotes,
} = require('../controllers/noteController');
const { validate } = require('../middleware/validate');
const { notes, revisions } = require('../validation/schemas');

const router = express.Router();
router.patch('/reorder', protect, validate({ body: notes.reorder }), reorderNotes);
router.get('/:id', protect, validate({ params: notes.id }), getNote);
router.use(protect);
router.patch('/:id/preferences', validate({ params: notes.id, body: notes.preferences }), updatePreference);
router.get('/:id/revisions', validate({ params: notes.id }), listRevisions);
router.post('/:id/revisions', validate({ params: notes.id, body: revisions.create }), createRevision);
router.post('/:id/revisions/:revisionId/restore', validate({ params: revisions.params }), restoreRevision);
router.post('/:id/duplicate', validate({ params: notes.id }), duplicateNote);
router.route('/')
  .get(validate({ query: notes.list }), listNotes)
  .post(validate({ body: notes.create }), createNote);
router.route('/:id')
  .put(validate({ params: notes.id, body: notes.update }), updateNote)
  .delete(validate({ params: notes.id }), deleteNote);
router.patch('/:id/archive', validate({ params: notes.id }), archiveNote);
router.patch('/:id/restore', validate({ params: notes.id }), restoreNote);

module.exports = router;
