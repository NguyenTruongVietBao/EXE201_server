const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');
const { cloudinary } = require('../configs/cloudinary');

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

    // Upload lên Cloudinary
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
// USER - USER
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'name avatar email')
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Conversation.countDocuments({
      participants: userId,
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách cuộc trò chuyện thành công',
      data: {
        conversations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách cuộc trò chuyện',
      data: null,
    });
  }
};
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Kiểm tra user có phải participant của conversation không
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Cuộc trò chuyện không tồn tại',
        data: null,
      });
    }

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xem cuộc trò chuyện này',
        data: null,
      });
    }

    // Lấy tin nhắn giữa 2 participants
    const [participant1, participant2] = conversation.participants;
    const messages = await Message.find({
      $or: [
        { senderId: participant1, receiverId: participant2 },
        { senderId: participant2, receiverId: participant1 },
      ],
    })
      .populate('senderId', 'name avatar email')
      .populate('receiverId', 'name avatar email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Message.countDocuments({
      $or: [
        { senderId: participant1, receiverId: participant2 },
        { senderId: participant2, receiverId: participant1 },
      ],
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy tin nhắn thành công',
      data: {
        messages: messages.reverse(), // Reverse để hiển thị từ cũ đến mới
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy tin nhắn',
      data: null,
    });
  }
};
exports.createConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user._id;

    if (!participantId) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'participantId là bắt buộc',
        data: null,
      });
    }

    if (participantId === userId.toString()) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Không thể tạo cuộc trò chuyện với chính mình',
        data: null,
      });
    }

    // Kiểm tra participant có tồn tại không
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
    let conversation = await Conversation.findBetweenUsers(
      userId,
      participantId
    );

    if (conversation) {
      // Nếu đã tồn tại, trả về conversation hiện có
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
      message: 'Lỗi server khi tạo cuộc trò chuyện',
      data: null,
    });
  }
};
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageType, content, fileUrl } = req.body;
    const senderId = req.user._id;

    // Validate input
    if (!messageType) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'messageType là bắt buộc',
        data: null,
      });
    }

    if (messageType === 'text' && !content) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'content là bắt buộc khi messageType = text',
        data: null,
      });
    }

    if (messageType === 'image' && !fileUrl) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'fileUrl là bắt buộc khi messageType = image',
        data: null,
      });
    }

    // Kiểm tra conversation có tồn tại không
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Cuộc trò chuyện không tồn tại',
        data: null,
      });
    }

    // Kiểm tra user có phải participant của conversation không
    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === senderId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này',
        data: null,
      });
    }

    // Tìm receiverId (participant còn lại)
    const receiverId = conversation.participants.find(
      (participantId) => participantId.toString() !== senderId.toString()
    );

    let imageUrl;
    if (fileUrl) {
      const uploadResponse = await cloudinary.uploader.upload(fileUrl);
      imageUrl = uploadResponse.secure_url;
    }
    // Tạo message mới
    const message = await Message.create({
      senderId,
      receiverId,
      messageType,
      content: content || null,
      fileUrl: imageUrl || null,
    });

    // Cập nhật conversation
    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();
    await conversation.save();

    // Populate message để trả về
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name avatar email')
      .populate('receiverId', 'name avatar email');

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
      message: 'Lỗi server khi gửi tin nhắn',
      data: null,
    });
  }
};

// USER - GROUP
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Kiểm tra user có phải member của group không
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại',
        data: null,
      });
    }

    const isMember = group.members.some(
      (member) => member.userId.toString() === userId.toString()
    );
    if (!isMember) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xem tin nhắn của nhóm này',
        data: null,
      });
    }

    const messages = await Message.find({ groupId })
      .populate('senderId', 'name avatar email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Message.countDocuments({ groupId });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy tin nhắn nhóm thành công',
      data: {
        messages: messages.reverse(), // Reverse để hiển thị từ cũ đến mới
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy tin nhắn nhóm',
      data: null,
    });
  }
};
exports.sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { messageType, content, fileUrl } = req.body;
    const senderId = req.user._id;

    // Validate input
    if (!messageType) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'messageType là bắt buộc',
        data: null,
      });
    }

    if (messageType === 'text' && !content) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'content là bắt buộc khi messageType = text',
        data: null,
      });
    }

    if (messageType === 'image' && !fileUrl) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'fileUrl là bắt buộc khi messageType = image',
        data: null,
      });
    }

    // Kiểm tra group có tồn tại không
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại',
        data: null,
      });
    }

    // Kiểm tra user có phải member của group không
    const isMember = group.members.some(
      (member) => member.userId.toString() === senderId.toString()
    );
    if (!isMember) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền gửi tin nhắn trong nhóm này',
        data: null,
      });
    }

    // Tạo message mới
    const message = await Message.create({
      senderId,
      groupId,
      messageType,
      content: content || null,
      fileUrl: fileUrl || null,
    });

    // Populate message để trả về
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name avatar email')
      .populate('groupId', 'name description');

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
      message: 'Lỗi server khi gửi tin nhắn nhóm',
      data: null,
    });
  }
};
