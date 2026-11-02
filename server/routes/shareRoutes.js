const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { searchUsers, invite, collaborators, updateRole, revoke, revokeInvitation, setPublic } = require('../controllers/shareController');
const { validate } = require('../middleware/validate');
const { sharing } = require('../validation/schemas');

const router = express.Router();
router.use(protect);
router.get('/users/search', validate({ query: sharing.userSearch }), searchUsers);
router.post('/:noteId/invite', validate({ params: sharing.noteId, body: sharing.invite }), invite);
router.get('/:noteId/collaborators', validate({ params: sharing.noteId }), collaborators);
router.patch('/:noteId/user/:userId', validate({ params: sharing.noteUser, body: sharing.updateRole }), updateRole);
router.delete('/:noteId/user/:userId', validate({ params: sharing.noteUser }), revoke);
router.delete('/:noteId/invitation/:invitationId', validate({ params: sharing.noteInvitation }), revokeInvitation);
router.patch('/:noteId/public', validate({ params: sharing.noteId, body: sharing.publicAccess }), setPublic);

module.exports = router;
