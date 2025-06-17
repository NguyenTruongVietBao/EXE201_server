const User = require('../models/User');
const { verifyToken } = require('../utils/auth');

const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('No token provided'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Token is not valid'));
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

module.exports = socketAuth;
