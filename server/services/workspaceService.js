const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');

const ensurePersonalWorkspace = async (user) => {
  const existing = await WorkspaceMembership.findOne({ user: user._id, role: 'owner', status: 'active' })
    .sort({ createdAt: 1 })
    .populate('workspace');
  if (existing?.workspace) return existing.workspace;

  const workspace = await Workspace.create({
    name: `${user.name}'s Workspace`,
    owner: user._id,
  });
  try {
    await WorkspaceMembership.create({
      workspace: workspace._id,
      user: user._id,
      role: 'owner',
    });
  } catch (error) {
    await workspace.deleteOne();
    throw error;
  }
  return workspace;
};

const requireWorkspaceMembership = async (workspaceId, userId, roles = ['owner', 'admin', 'member', 'guest']) => {
  const membership = await WorkspaceMembership.findOne({
    workspace: workspaceId,
    user: userId,
    status: 'active',
    role: { $in: roles },
  });
  return membership;
};

module.exports = { ensurePersonalWorkspace, requireWorkspaceMembership };
