const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { searchUsers, invite, collaborators, updateRole, revoke, setPublic } = require('../controllers/shareController');

const router = express.Router();
router.use(protect);
router.get('/users/search', searchUsers);
router.post('/:noteId/invite', invite);
router.get('/:noteId/collaborators', collaborators);
router.patch('/:noteId/user/:userId', updateRole);
router.delete('/:noteId/user/:userId', revoke);
router.patch('/:noteId/public', setPublic);

module.exports = router;
