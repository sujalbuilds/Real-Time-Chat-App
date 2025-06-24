require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');

const chatRoomsRouter = require('./routes/chatRooms');
const authRoutes = require('./routes/auth');
const jwtUtil = require('./config/jwt');
const User = require('./models/usermodel');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:3001', methods: ['GET', 'POST'] }
});


mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatApplication')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/chat-rooms', chatRoomsRouter);

const requireAuth = (req, res, next) => {
  console.log('🔒 Auth middleware triggered');
  console.log('🍪 All cookies:', req.cookies);
  console.log('🎫 Token cookie:', req.cookies.token);

  const token = req.cookies.token;
  if (!token) {
    console.log('❌ No token found, redirecting to login');
    return res.redirect('/login.html');
  }

  try {
    const payload = jwtUtil.verify(token);
    console.log('✅ Token verified:', payload);
    req.user = payload;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    res.clearCookie('token');
    res.clearCookie('currentUser');
    return res.redirect('/login.html');
  }
};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      jwtUtil.verify(token);
      return res.redirect('/');
    } catch (error) {
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      jwtUtil.verify(token);
      return res.redirect('/');
    } catch (error) {
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.use((req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      jwtUtil.verify(token);
      return res.redirect('/');
    } catch (error) {
      return res.redirect('/login.html');
    }
  }
  res.redirect('/login.html');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const tokenMatch = cookieHeader.match(/token=([^;]+)/);
    const token = tokenMatch?.[1];

    if (!token) throw new Error('Missing token');

    const payload = jwtUtil.verify(token);
    const user = await User.findById(payload.id);
    if (!user) throw new Error('Auth failed');

    socket.user = user;
    user.online = true;
    await user.save();
    next();
  } catch (err) {
    next(new Error('Authentication error: ' + err.message));
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} (user: ${socket.user.username})`);
  socket.currentRoom = null;

  io.emit('user-connected', { id: socket.user._id, username: socket.user.username });

  socket.on('join-room', async (roomId) => {
    try {
      if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        socket.to(socket.currentRoom).emit('system-message', `${socket.user.username} left the room`);
      }
      socket.join(roomId);
      socket.currentRoom = roomId;

      const history = await require('./models/chatmodel')
        .find({ room: roomId })
        .sort({ timestamp: 1 })
        .limit(50)
        .lean();
      socket.emit('chatHistory', history);

      io.to(roomId).emit('system-message', `${socket.user.username} joined the room`);
    } catch (err) {
      console.error('Error in join-room:', err);
      socket.emit('chatHistory', []);
    }
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('system-message', `${socket.user.username} left the room`);
    socket.currentRoom = null;
  });

  socket.on('chatMessage', async ({ message, timestamp, roomId }) => {
    if (socket.currentRoom !== roomId) return;
    try {
      await require('./models/chatmodel').create({
        user: socket.user._id,
        username: socket.user.username,
        message,
        timestamp,
        room: roomId
      });
    } catch (e) {
      console.error('Error saving chat message:', e);
    }
    io.to(roomId).emit('chatMessage', { username: socket.user.username, message, timestamp });
  });

  socket.on('startTyping', (roomId) => {
    if (socket.currentRoom === roomId) socket.to(roomId).emit('userStartedTyping', { username: socket.user.username });
  });
  socket.on('stopTyping', (roomId) => {
    if (socket.currentRoom === roomId) socket.to(roomId).emit('userStoppedTyping');
  });

  socket.on('send-invitation', (data) => {
    socket.broadcast.emit('invitation-received', {
      invitedBy: socket.user.username,
      roomName: data.roomName,
      roomId: data.roomId
    });
  });

  socket.on('invitation-responded', (data) => {
    io.to(data.roomId).emit('invitation-responded', {
      username: socket.user.username,
      response: data.response
    });
  });

  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);
    try {
      await User.findByIdAndUpdate(socket.user._id, { online: false });
    } catch (error) {
      console.error('Error updating user offline status:', error);
    }
    io.emit('user-disconnected', socket.user._id);
  });
});

const shutDown = () => {
  console.log('💤 Shutting down...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('❌ MongoDB connection closed.');
      process.exit(0);
    });
  });
};
process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

module.exports = { app, server, io };