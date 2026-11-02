require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Note = require('./models/Note');
const SharePermission = require('./models/SharePermission');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const shareRoutes = require('./routes/shareRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(server, { cors: { origin: clientUrl, credentials: true } });
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
    return permission?.role || (note.isPublished ? 'viewer' : null);
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

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/share', shareRoutes);
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
    emitPresence(room);
  });

  socket.on('leave-note', ({ noteId }) => {
    leaveNoteRoom(socket, noteId);
  });

  socket.on('send-changes', async ({ noteId, content }) => {
    const role = await roleForNote(noteId, socket.data.userId);
    if (!['owner', 'editor'].includes(role)) {
      if (role) socket.emit('permission-changed', { role });
      else {
        socket.emit('access-revoked');
        leaveNoteRoom(socket, noteId);
      }
      return;
    }
    socket.broadcast.to(`note:${noteId}`).emit('receive-changes', { content });
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
  server.listen(port, () => console.log(`Otion API listening on port ${port}`));
};

if (require.main === module) {
  start().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { app, server, io, start };
