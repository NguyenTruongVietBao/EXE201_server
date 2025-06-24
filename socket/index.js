const chatHandlers = require('./chatHandlers');
const socketAuth = require('../middlewares/socket.middleware');

// Store online users trong memory
const onlineUsers = new Map();

const socketHandler = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected: ${socket.userId}`);

    // Join user room để nhận tin nhắn
    socket.join(`user_${socket.userId}`);

    // Thêm user vào danh sách online
    const userInfo = {
      userId: socket.userId.toString(),
      name: socket.user.name,
      email: socket.user.email,
      avatar: socket.user.avatar,
      socketId: socket.id,
    };
    onlineUsers.set(socket.userId.toString(), userInfo);

    // Gửi danh sách online users hiện tại cho user vừa connect
    socket.emit('online_users', Array.from(onlineUsers.values()));

    // Thông báo user online cho các users khác
    socket.broadcast.emit('user_online', userInfo);

    // Register chat handlers
    chatHandlers(socket, io);

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.name} disconnected`);

      // Remove user từ danh sách online
      onlineUsers.delete(socket.userId.toString());

      socket.broadcast.emit('user_offline', {
        userId: socket.userId.toString(),
      });
    });
  });
};

module.exports = socketHandler;
