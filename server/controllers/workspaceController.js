const asyncHandler = require('express-async-handler');
const WorkspaceMembership = require('../models/WorkspaceMembership');

const listWorkspaces = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMembership.find({ user: req.user._id, status: 'active' })
    .populate('workspace')
    .sort({ updatedAt: -1 });
  res.json(memberships
    .filter((membership) => membership.workspace)
    .map((membership) => ({
      ...membership.workspace.toObject(),
      membershipRole: membership.role,
    })));
});

module.exports = { listWorkspaces };
