const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { listWorkspaces } = require('../controllers/workspaceController');

const router = express.Router();
router.use(protect);
router.get('/', listWorkspaces);

module.exports = router;
