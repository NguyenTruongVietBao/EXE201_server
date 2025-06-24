const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');
const { cloudinary } = require('../configs/cloudinary');

// Upload ảnh cho chat
exports.uploadChatImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Không có file được upload',
        data: null,
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'chat_images',
      resource_type: 'image',
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Upload hình ảnh thành công',
      data: {
        fileUrl: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error('Upload chat image error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi upload hình ảnh',
      data: null,
    });
  }
};

// Lấy danh sách cuộc trò chuyện 1-1
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'name avatar email')
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách cuộc trò chuyện thành công',
      data: conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// Lấy tin nhắn của cuộc trò chuyện 1-1
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Cuộc trò chuyện không tồn tại',
        data: null,
      });
    }

    const messages = await Message.find({
      conversationId: conversationId,
    })
      .populate('senderId', 'name avatar email')
      .sort({ createdAt: 1 });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy tin nhắn thành công',
      data: messages,
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// Tạo cuộc trò chuyện 1-1
exports.createConversation = async (req, res) => {
  try {
    const { participantId } = req.params;
    const userId = req.user._id;

    if (!participantId || participantId === userId.toString()) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'ID người tham gia không hợp lệ',
        data: null,
      });
    }

    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Người dùng không tồn tại',
        data: null,
      });
    }

    // Kiểm tra conversation đã tồn tại chưa
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId] },
    });

    if (conversation) {
      const populatedConversation = await Conversation.findById(
        conversation._id
      )
        .populate('participants', 'name avatar email')
        .populate('lastMessage');

      return res.status(200).json({
        status: true,
        statusCode: 200,
        message: 'Cuộc trò chuyện đã tồn tại',
        data: populatedConversation,
      });
    }

    // Tạo conversation mới
    conversation = await Conversation.create({
      participants: [userId, participantId],
    });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name avatar email')
      .populate('lastMessage');

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo cuộc trò chuyện thành công',
      data: populatedConversation,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// Gửi tin nhắn 1-1
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageType, content, fileUrl } = req.body;
    const senderId = req.user._id;

    if (
      !messageType ||
      (messageType === 'text' && !content) ||
      (messageType === 'image' && !fileUrl)
    ) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Dữ liệu tin nhắn không hợp lệ',
        data: null,
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(senderId)) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Cuộc trò chuyện không tồn tại',
        data: null,
      });
    }

    const message = await Message.create({
      senderId,
      conversationId,
      messageType,
      content: content || null,
      fileUrl: fileUrl || null,
    });

    // Cập nhật conversation
    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date(Date.now());
    await conversation.save();

    const populatedMessage = await Message.findById(message._id).populate(
      'senderId',
      'name avatar email'
    );

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Gửi tin nhắn thành công',
      data: populatedMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// Lấy tin nhắn nhóm
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (
      !group ||
      !group.members.some(
        (member) => member.userId.toString() === userId.toString()
      )
    ) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại hoặc bạn không phải thành viên',
        data: null,
      });
    }

    const messages = await Message.find({ groupId })
      .populate('senderId', 'name avatar email')
      .sort({ createdAt: 1 });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy tin nhắn nhóm thành công',
      data: messages,
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// Gửi tin nhắn nhóm
exports.sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { messageType, content, fileUrl } = req.body;
    const senderId = req.user._id;

    if (
      !messageType ||
      (messageType === 'text' && !content) ||
      (messageType === 'image' && !fileUrl)
    ) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Dữ liệu tin nhắn không hợp lệ',
        data: null,
      });
    }

    const group = await Group.findById(groupId);
    if (
      !group ||
      !group.members.some(
        (member) => member.userId.toString() === senderId.toString()
      )
    ) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại hoặc bạn không phải thành viên',
        data: null,
      });
    }

    const message = await Message.create({
      senderId,
      groupId,
      messageType,
      content: content || null,
      fileUrl: fileUrl || null,
    });

    const populatedMessage = await Message.findById(message._id).populate(
      'senderId',
      'name avatar email'
    );

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Gửi tin nhắn nhóm thành công',
      data: populatedMessage,
    });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// Lấy danh sách nhóm đã tham gia
exports.getJoinedGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({
      'members.userId': userId,
    })
      .populate('createdBy', 'name avatar email')
      .select('name description avatar createdBy members createdAt')
      .sort({ createdAt: -1 });

    const formattedGroups = groups.map((group) => ({
      _id: group._id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      createdBy: group.createdBy,
      memberCount: group.members.length,
      createdAt: group.createdAt,
    }));

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách nhóm thành công',
      data: formattedGroups,
    });
  } catch (error) {
    console.error('Get joined groups error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
