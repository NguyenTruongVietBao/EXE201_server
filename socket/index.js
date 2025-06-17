const chatHandlers = require('./chatHandlers');
const socketAuth = require('../middlewares/socket.middleware');

const socketHandler = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(
      `User ${socket.user.name} connected with socket ID: ${socket.userId}`
    );

    socket.join(`user_${socket.userId}`);

    if (socket.user.groups && socket.user.groups.length > 0) {
      socket.user.groups.forEach((groupId) => {
        socket.join(`group_${groupId}`);
      });
    }

    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      name: socket.user.name,
      email: socket.user.email,
      avatar: socket.user.avatar,
    });

    chatHandlers(socket, io);

    socket.on('disconnect', () => {
      console.log(`User ${socket.user.name} disconnected`);
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
      });
    });
  });
};

module.exports = socketHandler;
