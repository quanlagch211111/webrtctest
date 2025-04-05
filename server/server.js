require('dotenv').config();
const express = require('express');
const app = express();
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const cors = require('cors');
const path = require('path');
const socketIO = require('socket.io');

const server = http.createServer(app);

// Peer server configuration
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs',
  concurrent_limit: 20, // Increased connection limit
  proxied: true
});

// Middleware
app.use(cors({
  origin: "http://localhost:3000", // Your React app's URL
  credentials: true
}));
app.use(express.json());
app.use('/peerjs', peerServer);

// Serve static files from React app
app.use(express.static(path.join(__dirname, 'client/build')));

// API endpoints
app.get('/api', (req, res) => {
  res.json({ message: 'Video Chat API' });
});

app.get('/api/room', (req, res) => {
  res.json({ roomId: uuidv4() });
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Socket.io configuration
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

// Track active rooms and users
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    
    // Initialize room if not exists
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    
    // Add user to room
    activeRooms.get(roomId).add(userId);
    
    // Notify others in the room
    socket.to(roomId).emit('user-connected', userId);
    console.log(`User ${userId} joined room ${roomId}`);

    // Send list of existing users to the new participant
    const users = Array.from(activeRooms.get(roomId)).filter(id => id !== userId);
    socket.emit('existing-users', users);

    // Message handling
    socket.on('message', (message) => {
      io.to(roomId).emit('createMessage', {
        sender: userId,
        text: message,
        timestamp: new Date().toISOString()
      });
    });

    // Disconnection handling
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
      socket.to(roomId).emit('user-disconnected', userId);
      
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(userId);
        
        // Clean up empty rooms
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`PeerJS server running on /peerjs`);
});