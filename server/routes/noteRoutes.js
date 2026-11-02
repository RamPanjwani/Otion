const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listNotes, createNote, getNote, getPublicNote, updateNote, archiveNote, restoreNote, deleteNote,
} = require('../controllers/noteController');

const router = express.Router();
router.get('/:id/public', getPublicNote);
router.get('/:id', protect, getNote);
router.use(protect);
router.route('/').get(listNotes).post(createNote);
router.route('/:id').put(updateNote).delete(deleteNote);
router.patch('/:id/archive', archiveNote);
router.patch('/:id/restore', restoreNote);

module.exports = router;
