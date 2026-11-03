require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Note = require('./models/Note');
const SharePermission = require('./models/SharePermission');
const { applyUpdate: applyCollaborationUpdate, flushAllDocuments, syncPayload } = require('./services/collaborationService');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const shareRoutes = require('./routes/shareRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const publicRoutes = require('./routes/publicRoutes');
const searchRoutes = require('./routes/searchRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/security');
const { configuredOrigins, isOriginAllowed, corsOptions } = require('./config/cors');

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: (origin, callback) => callback(null, isOriginAllowed(origin)), credentials: true } });
const presence = new Map();
app.set('io', io);

const membersFor = (room) => [...(presence.get(room)?.entries() || [])]
  .map(([socketId, member]) => ({ socketId, ...member }));

const emitPresence = (room) => io.to(room).emit('presence-update', membersFor(room));

const leaveNoteRoom = (socket, noteId) => {
  const room = `note:${noteId}`;
  socket.leave(room);
  presence.get(room)?.delete(socket.id);
  if (presence.get(room)?.size === 0) presence.delete(room);
  if (socket.data.noteId === noteId) socket.data.noteId = null;
  emitPresence(room);
};

const roleForNote = async (noteId, userId) => {
  try {
    if (!mongoose.isValidObjectId(noteId)) return null;
    const note = await Note.findById(noteId).select('user isPublished isArchived');
    if (!note || note.isArchived) return null;
    if (note.user.equals(userId)) return 'owner';
    const permission = await SharePermission.findOne({ noteId, userId }).select('role');
    return permission?.role || null;
  } catch {
    return null;
  }
};

io.evictUserFromNote = (noteId, userId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.noteId === noteId && socket.data.userId === String(userId)) {
      socket.emit('access-revoked');
      leaveNoteRoom(socket, noteId);
    }
  }
};

io.notifyUserRole = (noteId, userId, role) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.noteId === noteId && socket.data.userId === String(userId)) {
      socket.emit('permission-changed', { role });
    }
  }
};

io.disconnectUser = (userId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId === String(userId)) {
      socket.emit('account-deleted');
      socket.disconnect(true);
    }
  }
};

io.revalidateNoteAccess = async (noteId) => {
  const sockets = [...io.sockets.sockets.values()].filter((socket) => socket.data.noteId === noteId);
  await Promise.all(sockets.map(async (socket) => {
    const role = await roleForNote(noteId, socket.data.userId);
    if (!role) {
      socket.emit('access-revoked');
      leaveNoteRoom(socket, noteId);
    } else {
      socket.emit('permission-changed', { role });
    }
  }));
};

app.disable('x-powered-by');
app.use(pinoHttp({
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
  autoLogging: process.env.NODE_ENV !== 'test',
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(database === 'connected' || process.env.NODE_ENV === 'test' ? 200 : 503).json({ status: database === 'connected' ? 'ok' : 'degraded', database });
});
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use(notFound);
app.use(errorHandler);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('name email avatarUrl');
    if (!user) return next(new Error('Authentication required'));
    socket.data.userId = String(user._id);
    socket.data.user = { _id: String(user._id), name: user.name, avatarUrl: user.avatarUrl };
    socket.join(`user:${user._id}`);
    next();
  } catch {
    next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  socket.on('join-note', async ({ noteId }) => {
    const role = await roleForNote(noteId, socket.data.userId);
    if (!role) {
      socket.emit('access-revoked');
      return;
    }
    const room = `note:${noteId}`;
    socket.join(room);
    socket.data.noteId = noteId;
    const roomPresence = presence.get(room) || new Map();
    roomPresence.set(socket.id, socket.data.user);
    presence.set(room, roomPresence);
    socket.emit('permission-changed', { role });
    try {
      socket.emit('collab-sync', await syncPayload(noteId));
    } catch {
      socket.emit('collab-error', { message: 'Unable to synchronize this document' });
    }
    emitPresence(room);
  });

  socket.on('leave-note', ({ noteId }) => {
    leaveNoteRoom(socket, noteId);
  });

  socket.on('collab-update', async ({ noteId, update }, acknowledge) => {
    const respond = typeof acknowledge === 'function' ? acknowledge : () => undefined;
    const role = await roleForNote(noteId, socket.data.userId);
    if (!['owner', 'editor'].includes(role) || socket.data.noteId !== noteId) {
      if (role) socket.emit('permission-changed', { role });
      else {
        socket.emit('access-revoked');
        leaveNoteRoom(socket, noteId);
      }
      respond({ ok: false, code: 'FORBIDDEN' });
      return;
    }
    try {
      const result = await applyCollaborationUpdate(noteId, update, socket.data.userId);
      socket.broadcast.to(`note:${noteId}`).emit('collab-update', { update, sequence: result.sequence });
      respond({ ok: true, sequence: result.sequence });
    } catch {
      respond({ ok: false, code: 'INVALID_UPDATE' });
    }
  });

  socket.on('cursor-move', ({ noteId, position }) => {
    if (socket.data.noteId !== noteId) return;
    socket.broadcast.to(`note:${noteId}`).emit('cursor-move', { socketId: socket.id, user: socket.data.user, position });
  });

  socket.on('selection-change', ({ noteId, selection }) => {
    if (socket.data.noteId !== noteId) return;
    socket.broadcast.to(`note:${noteId}`).emit('selection-change', {
      socketId: socket.id,
      user: socket.data.user,
      selection,
    });
  });

  socket.on('disconnect', () => {
    if (socket.data.noteId) leaveNoteRoom(socket, socket.data.noteId);
  });
});

const port = process.env.PORT || 5000;
const start = async () => {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error('MONGO_URI and JWT_SECRET must be configured');
  }
  await connectDB();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  console.log(`Otion API listening on port ${server.address().port}`);
  return server;
};

const stop = async () => {
  await flushAllDocuments();
  await new Promise((resolve) => io.close(resolve));
  await mongoose.disconnect();
};

if (require.main === module) {
  start().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down`);
    stop().then(() => process.exit(0)).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, server, io, start, stop };
