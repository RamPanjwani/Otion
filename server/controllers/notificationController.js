const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('actor', 'name avatarUrl')
    .populate('note', 'title icon');
  res.json(notifications);
});

const markRead = asyncHandler(async (req, res) => {
  if (req.params.id === 'all') {
    await Notification.updateMany({ recipient: req.user._id, readAt: null }, { readAt: new Date() });
  } else {
    await Notification.updateOne({ _id: req.params.id, recipient: req.user._id }, { readAt: new Date() });
  }
  res.json({ ok: true });
});

module.exports = { listNotifications, markRead };
