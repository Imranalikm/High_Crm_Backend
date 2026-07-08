const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Should match CORS settings in app.js for production
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        include: [{ model: Role, as: 'role' }]
      });
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('[Socket.io] Auth error:', err.message);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] User connected: ${socket.user.id} (${socket.user.name})`);

    // Users and admins can join specific ticket rooms to receive real-time updates
    socket.on('join_ticket', (ticketId) => {
      socket.join(`ticket_${ticketId}`);
      console.log(`[Socket.io] User ${socket.user.id} joined room ticket_${ticketId}`);
    });

    socket.on('leave_ticket', (ticketId) => {
      socket.leave(`ticket_${ticketId}`);
      console.log(`[Socket.io] User ${socket.user.id} left room ticket_${ticketId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] User disconnected: ${socket.user.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIo
};
