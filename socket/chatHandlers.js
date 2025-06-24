const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');

const chatHandlers = (socket, io) => {
  // Gửi tin nhắn 1-1
  socket.on('send_direct_message', async (data) => {
    try {
      const { receiverId, messageType, content, fileUrl } = data;
      const senderId = socket.userId;

      // Validate input
      if (!receiverId || receiverId === senderId.toString()) {
        socket.emit('error', { message: 'ID người nhận không hợp lệ' });
        return;
      }

      if (
        !messageType ||
        (messageType === 'text' && !content) ||
        (messageType === 'image' && !fileUrl)
      ) {
        socket.emit('error', { message: 'Dữ liệu tin nhắn không hợp lệ' });
        return;
      }

      // Kiểm tra receiver có tồn tại
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        socket.emit('error', { message: 'Người nhận không tồn tại' });
        return;
      }

      // Tìm hoặc tạo conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
        });
      }

      // Tạo message
      const message = await Message.create({
        senderId,
        conversationId: conversation._id,
        messageType,
        content: content || null,
        fileUrl: fileUrl || null,
      });

      // Cập nhật conversation
      conversation.lastMessage = message._id;
      conversation.lastActivity = new Date(Date.now());
      await conversation.save();

      // Populate message
      const populatedMessage = await Message.findById(message._id).populate(
        'senderId',
        'name avatar email'
      );

      // Gửi tin nhắn cho cả 2 users
      io.to(`user_${senderId}`).emit('new_direct_message', populatedMessage);
      io.to(`user_${receiverId}`).emit('new_direct_message', populatedMessage);

      socket.emit('message_sent', { messageId: message._id });
    } catch (error) {
      console.error('Send direct message error:', error);
      socket.emit('error', { message: 'Gửi tin nhắn thất bại' });
    }
  });

  // Gửi tin nhắn nhóm
  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, messageType, content, fileUrl } = data;
      const senderId = socket.userId;

      // Validate input
      if (!groupId) {
        socket.emit('error', { message: 'ID nhóm là bắt buộc' });
        return;
      }

      if (
        !messageType ||
        (messageType === 'text' && !content) ||
        (messageType === 'image' && !fileUrl)
      ) {
        socket.emit('error', { message: 'Dữ liệu tin nhắn không hợp lệ' });
        return;
      }

      // Kiểm tra group và membership
      const group = await Group.findById(groupId);
      if (!group) {
        socket.emit('error', { message: 'Nhóm không tồn tại' });
        return;
      }

      const isMember = group.members.some(
        (member) => member.userId.toString() === senderId.toString()
      );
      if (!isMember) {
        socket.emit('error', {
          message: 'Bạn không phải thành viên của nhóm này',
        });
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

      // Populate message
      const populatedMessage = await Message.findById(message._id).populate(
        'senderId',
        'name avatar email'
      );

      // Gửi tin nhắn cho tất cả members trong group
      io.to(`group_${groupId}`).emit('new_group_message', populatedMessage);

      socket.emit('message_sent', { messageId: message._id });
    } catch (error) {
      console.error('Send group message error:', error);
      socket.emit('error', { message: 'Gửi tin nhắn nhóm thất bại' });
    }
  });

  // Join group room
  socket.on('join_group', async (data) => {
    try {
      const { groupId } = data;
      const userId = socket.userId;

      const group = await Group.findById(groupId);
      if (!group) {
        socket.emit('error', { message: 'Nhóm không tồn tại' });
        return;
      }

      const isMember = group.members.some(
        (member) => member.userId.toString() === userId.toString()
      );
      if (!isMember) {
        socket.emit('error', {
          message: 'Bạn không phải thành viên của nhóm này',
        });
        return;
      }

      socket.join(`group_${groupId}`);
      socket.emit('joined_group', { groupId });
    } catch (error) {
      console.error('Join group error:', error);
      socket.emit('error', { message: 'Tham gia nhóm thất bại' });
    }
  });

  // Leave group room
  socket.on('leave_group', (data) => {
    const { groupId } = data;
    if (groupId) {
      socket.leave(`group_${groupId}`);
      socket.emit('left_group', { groupId });
    }
  });
};

module.exports = chatHandlers;
