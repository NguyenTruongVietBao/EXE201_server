const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');

const chatHandlers = (socket, io) => {
  // Gửi tin nhắn trực tiếp giữa 2 users
  socket.on('send_direct_message', async (data) => {
    try {
      const { receiverId, messageType, content, fileUrl } = data;
      const senderId = socket.userId;

      if (!receiverId) {
        socket.emit('error', { message: 'receiverId is required' });
        return;
      }
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        socket.emit('error', { message: 'Receiver not found' });
        return;
      }

      if (messageType === 'text' && !content) {
        socket.emit('error', {
          message: 'content is required for text message',
        });
        return;
      }
      if (messageType === 'image' && !fileUrl) {
        socket.emit('error', {
          message: 'fileUrl is required for image message',
        });
        return;
      }

      // Tạo hoặc tìm conversation
      let conversation = await Conversation.findBetweenUsers(
        senderId,
        receiverId
      );
      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
        });
      }

      // Tạo message
      const message = await Message.create({
        senderId,
        receiverId,
        messageType,
        content: content || null,
        fileUrl: fileUrl || null,
      });

      // Cập nhật conversation
      conversation.lastMessage = message._id;
      conversation.lastActivity = new Date().toLocaleString();
      await conversation.save();

      // Populate message để gửi về client
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'name avatar email')
        .populate('receiverId', 'name avatar email');

      // Gửi tin nhắn cho cả 2 users
      io.to(`user_${senderId}`).emit('new_direct_message', populatedMessage);
      io.to(`user_${receiverId}`).emit('new_direct_message', populatedMessage);

      // Xác nhận gửi thành công
      socket.emit('message_sent', { messageId: message._id });
    } catch (error) {
      console.error('Send direct message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Gửi tin nhắn trong group
  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, messageType, content, fileUrl } = data;
      const senderId = socket.userId;

      // Validate data
      if (!groupId) {
        socket.emit('error', { message: 'groupId is required' });
        return;
      }

      if (messageType === 'text' && !content) {
        socket.emit('error', {
          message: 'content is required for text message',
        });
        return;
      }

      if (messageType === 'image' && !fileUrl) {
        socket.emit('error', {
          message: 'fileUrl is required for image message',
        });
        return;
      }

      // Kiểm tra group có tồn tại không
      const group = await Group.findById(groupId);
      if (!group) {
        socket.emit('error', { message: 'Group not found' });
        return;
      }

      // Kiểm tra user có phải member của group không
      const isMember = group.members.some(
        (member) => member.userId.toString() === senderId
      );
      if (!isMember) {
        socket.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      // Tạo message
      const message = await Message.create({
        senderId,
        groupId,
        messageType,
        content: content || null,
        fileUrl: fileUrl || null,
      });

      // Populate message để gửi về client
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'name avatar email')
        .populate('groupId', 'name description');

      // Gửi tin nhắn cho tất cả members trong group
      io.to(`group_${groupId}`).emit('new_group_message', populatedMessage);

      // Xác nhận gửi thành công
      socket.emit('message_sent', { messageId: message._id });
    } catch (error) {
      console.error('Send group message error:', error);
      socket.emit('error', { message: 'Failed to send group message' });
    }
  });

  // Join group room (khi user join group mới)
  socket.on('join_group', async (data) => {
    try {
      const { groupId } = data;
      const userId = socket.userId;

      // Kiểm tra user có phải member của group không
      const group = await Group.findById(groupId);
      if (!group) {
        socket.emit('error', { message: 'Group not found' });
        return;
      }

      const isMember = group.members.some(
        (member) => member.userId.toString() === userId
      );
      if (!isMember) {
        socket.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      // Join room
      socket.join(`group_${groupId}`);
      socket.emit('joined_group', { groupId });
    } catch (error) {
      console.error('Join group error:', error);
      socket.emit('error', { message: 'Failed to join group' });
    }
  });

  // Typing indicator cho direct chat
  socket.on('typing_start', (data) => {
    const { receiverId } = data;
    if (receiverId) {
      io.to(`user_${receiverId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.name,
      });
    }
  });
  socket.on('typing_stop', (data) => {
    const { receiverId } = data;
    if (receiverId) {
      io.to(`user_${receiverId}`).emit('user_stop_typing', {
        userId: socket.userId,
      });
    }
  });

  // Typing indicator cho group chat
  socket.on('group_typing_start', (data) => {
    const { groupId } = data;
    if (groupId) {
      socket.to(`group_${groupId}`).emit('user_typing_group', {
        userId: socket.userId,
        userName: socket.user.name,
        groupId,
      });
    }
  });
  socket.on('group_typing_stop', (data) => {
    const { groupId } = data;
    if (groupId) {
      socket.to(`group_${groupId}`).emit('user_stop_typing_group', {
        userId: socket.userId,
        groupId,
      });
    }
  });
};

module.exports = chatHandlers;
