const Group = require('../models/Group');
const JoinGroupRequest = require('../models/JoinGroupRequest');
const User = require('../models/User');

// Tạo nhóm mới
exports.createGroup = async (req, res) => {
  try {
    const { name, description, maxMembers, interests } = req.body;
    const createdBy = req.user._id;

    if (!name || !description) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Tên và mô tả nhóm không được để trống',
        data: null,
      });
    }

    const group = await Group.create({
      name,
      description,
      createdBy,
      maxMembers: maxMembers || 100,
      interests: interests || [],
      members: [
        {
          userId: createdBy,
          isAdmin: true, // Creator là admin
          joinDate: new Date(Date.now()),
        },
      ],
    });

    // Thêm group vào danh sách groups của user
    await User.findByIdAndUpdate(createdBy, {
      $push: { groups: group._id },
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name avatar email')
      .populate('members.userId', 'name avatar email')
      .populate('interests', 'name emoji');

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo nhóm thành công',
      data: populatedGroup,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi tạo nhóm',
      data: null,
    });
  }
};

// Gửi yêu cầu join nhóm
exports.sendJoinRequest = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại',
        data: null,
      });
    }

    // Kiểm tra user đã là member chưa
    const isMember = group.members.some(
      (member) => member.userId.toString() === userId.toString()
    );
    if (isMember) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Bạn đã là thành viên của nhóm này',
        data: null,
      });
    }

    // Kiểm tra nhóm đã đầy chưa
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Nhóm đã đạt số lượng thành viên tối đa',
        data: null,
      });
    }

    // Kiểm tra đã gửi request chưa
    const existingRequest = await JoinGroupRequest.findOne({
      userId,
      groupId,
      status: 'PENDING',
    });
    if (existingRequest) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Bạn đã gửi yêu cầu join nhóm này rồi',
        data: null,
      });
    }

    const joinRequest = await JoinGroupRequest.create({
      userId,
      groupId,
      message: message || '',
    });

    const populatedRequest = await JoinGroupRequest.findById(joinRequest._id)
      .populate('userId', 'name avatar email')
      .populate('groupId', 'name description');

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Gửi yêu cầu join nhóm thành công',
      data: populatedRequest,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi gửi yêu cầu join nhóm',
      data: null,
    });
  }
};

// Chấp nhận yêu cầu join nhóm
exports.acceptJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    const joinRequest = await JoinGroupRequest.findById(requestId)
      .populate('userId', 'name avatar email')
      .populate('groupId');

    if (!joinRequest) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Yêu cầu join không tồn tại',
        data: null,
      });
    }

    if (joinRequest.status !== 'PENDING') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Yêu cầu đã được xử lý rồi',
        data: null,
      });
    }

    // Kiểm tra quyền: chỉ admin của group mới được xử lý
    const group = await Group.findById(joinRequest.groupId);
    const isAdmin = group.members.some(
      (member) =>
        member.userId.toString() === currentUserId.toString() && member.isAdmin
    );

    if (!isAdmin) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xử lý yêu cầu này',
        data: null,
      });
    }

    // Kiểm tra nhóm đã đầy chưa
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Nhóm đã đạt số lượng thành viên tối đa',
        data: null,
      });
    }

    // Thêm user vào nhóm
    group.members.push({
      userId: joinRequest.userId._id,
      isAdmin: false,
      joinDate: new Date(Date.now()),
    });
    await group.save();

    // Thêm group vào danh sách groups của user
    await User.findByIdAndUpdate(joinRequest.userId._id, {
      $push: { groups: group._id },
    });

    // Cập nhật status của join request
    joinRequest.status = 'ACCEPTED';
    await joinRequest.save();

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Chấp nhận yêu cầu join nhóm thành công',
      data: joinRequest,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi chấp nhận yêu cầu',
      data: null,
    });
  }
};

// Từ chối yêu cầu join nhóm
exports.rejectJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const currentUserId = req.user._id;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Lý do từ chối không được để trống',
        data: null,
      });
    }

    const joinRequest = await JoinGroupRequest.findById(requestId)
      .populate('userId', 'name avatar email')
      .populate('groupId');

    if (!joinRequest) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Yêu cầu join không tồn tại',
        data: null,
      });
    }

    if (joinRequest.status !== 'PENDING') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Yêu cầu đã được xử lý rồi',
        data: null,
      });
    }

    // Kiểm tra quyền: chỉ admin của group mới được xử lý
    const group = await Group.findById(joinRequest.groupId);
    const isAdmin = group.members.some(
      (member) =>
        member.userId.toString() === currentUserId.toString() && member.isAdmin
    );

    if (!isAdmin) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xử lý yêu cầu này',
        data: null,
      });
    }

    // Cập nhật status và lý do từ chối
    joinRequest.status = 'REJECTED';
    joinRequest.rejectionReason = rejectionReason.trim();
    await joinRequest.save();

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Từ chối yêu cầu join nhóm thành công',
      data: joinRequest,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi từ chối yêu cầu',
      data: null,
    });
  }
};

// Lấy tất cả groups
exports.getAllGroups = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const groups = await Group.find()
      .populate('createdBy', 'name avatar email')
      .populate('members.userId', 'name avatar email')
      .populate('interests', 'name emoji')
      .skip(skip);

    const totalCount = await Group.countDocuments();

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách nhóm thành công',
      data: {
        groups,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách nhóm',
      data: null,
    });
  }
};

// Lấy thông tin chi tiết nhóm
exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    // Lấy thông tin group cơ bản
    const group = await Group.findById(groupId)
      .populate('createdBy', 'name avatar email')
      .populate('members.userId', 'name avatar email')
      .populate('interests', 'name emoji');

    if (!group) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại',
        data: null,
      });
    }

    // Kiểm tra xem user hiện tại có phải là thành viên không
    const currentMember = group.members.find(
      (member) => member.userId._id.toString() === currentUserId.toString()
    );

    const isCreator =
      group.createdBy._id.toString() === currentUserId.toString();
    const isMember = !!currentMember;
    const isAdmin = currentMember?.isAdmin || isCreator;

    // Lấy tin nhắn gần đây (chỉ cho thành viên)
    let recentMessages = [];
    if (isMember) {
      const Message = require('../models/Message');
      recentMessages = await Message.find({ groupId })
        .populate('senderId', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(10);
    }

    // Lấy yêu cầu tham gia pending (chỉ cho admin)
    let pendingRequests = [];
    if (isAdmin) {
      const JoinGroupRequest = require('../models/JoinGroupRequest');
      pendingRequests = await JoinGroupRequest.find({
        groupId,
        status: 'PENDING',
      })
        .populate('userId', 'name avatar email')
        .sort({ createdAt: -1 });
    }

    // Thống kê group
    const stats = {
      totalMembers: group.members.length,
      maxMembers: group.maxMembers,
      availableSlots: group.maxMembers - group.members.length,
      joinedThisMonth: group.members.filter((member) => {
        const joinDate = new Date(member.joinDate);
        const thisMonth = new Date();
        thisMonth.setDate(1);
        return joinDate >= thisMonth;
      }).length,
      totalInterests: group.interests.length,
      pendingRequestsCount: pendingRequests.length,
    };

    // Gợi ý thành viên mới (dựa trên interests chung)
    const User = require('../models/User');
    let suggestedMembers = [];
    if (isAdmin) {
      const groupInterestIds = group.interests.map((interest) => interest._id);
      const currentMemberIds = group.members.map((member) => member.userId._id);

      suggestedMembers = await User.find({
        _id: { $nin: [...currentMemberIds, currentUserId] },
        interests: { $in: groupInterestIds },
        isBanned: false,
        isVerified: true,
      })
        .populate('interests', 'name emoji')
        .limit(5)
        .select('name avatar email interests');
    }

    // Tính tỷ lệ hoạt động (số tin nhắn trong 7 ngày qua)
    let activityRate = 0;
    if (isMember) {
      const Message = require('../models/Message');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const recentMessagesCount = await Message.countDocuments({
        groupId,
        createdAt: { $gte: weekAgo },
      });

      activityRate = Math.min(
        100,
        Math.round((recentMessagesCount / 10) * 100)
      );
    }

    const responseData = {
      groupInfo: {
        _id: group._id,
        name: group.name,
        description: group.description,
        createdBy: group.createdBy,
        interests: group.interests,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
      members: group.members,
      userPermissions: {
        isMember,
        isAdmin,
        isCreator,
        canInvite: isAdmin,
        canManageMembers: isAdmin,
        canViewMessages: isMember,
        canSendMessages: isMember,
      },
      statistics: stats,
      activityRate,
      ...(isMember && { recentMessages: recentMessages.reverse() }), // Đảo ngược để hiển thị theo thứ tự thời gian
    };

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin chi tiết nhóm thành công',
      data: responseData,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy thông tin nhóm',
      data: null,
    });
  }
};

// Lấy danh sách yêu cầu join của nhóm (chỉ admin)
exports.getGroupJoinRequests = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;
    const { status = 'PENDING' } = req.query;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Nhóm không tồn tại',
        data: null,
      });
    }

    // Kiểm tra quyền admin
    const isAdmin = group.members.some(
      (member) =>
        member.userId.toString() === currentUserId.toString() && member.isAdmin
    );

    if (!isAdmin) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xem yêu cầu join của nhóm này',
        data: null,
      });
    }

    const requests = await JoinGroupRequest.find({
      groupId,
      status,
    })
      .populate('userId', 'name avatar email')
      .populate('groupId', 'name description members interests')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu join thành công',
      data: requests,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách yêu cầu',
      data: null,
    });
  }
};

// Lấy danh sách nhóm đã tham gia
exports.getJoinedGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tìm các nhóm mà user là member
    const groups = await Group.find({ 'members.userId': userId })
      .populate('createdBy', 'name avatar email')
      .populate('interests', 'name emoji')
      .populate('members.userId', 'name avatar email')
      .sort({ updatedAt: -1 });

    // Thêm thông tin vai trò của user trong mỗi nhóm
    const groupsWithUserRole = groups.map((group) => {
      const userMember = group.members.find(
        (member) => member.userId._id.toString() === userId.toString()
      );

      return {
        ...group.toObject(),
        // Xác định userRole: ADMIN nếu là creator hoặc có isAdmin = true
        userRole:
          group.createdBy._id.toString() === userId.toString()
            ? 'ADMIN'
            : userMember?.isAdmin
            ? 'ADMIN'
            : 'MEMBER',
        joinDate: userMember?.joinDate,
      };
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách nhóm đã tham gia thành công',
      data: {
        groups: groupsWithUserRole,
      },
    });
  } catch (error) {
    console.error('Get joined groups error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách nhóm đã tham gia',
      data: null,
    });
  }
};

// Lấy danh sách nhóm mà tôi tạo
exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tìm các nhóm mà user đã tạo
    const groups = await Group.find({ createdBy: userId })
      .populate('createdBy', 'name avatar email')
      .populate('members.userId', 'name avatar email')
      .populate('interests', 'name emoji')
      .sort({ createdAt: -1 });

    // Thêm thông tin thống kê cho mỗi nhóm
    const groupsWithStats = groups.map((group) => {
      return {
        ...group.toObject(),
        memberCount: group.members.length,
        // Tính số admin trong nhóm
        adminCount: group.members.filter((member) => member.isAdmin).length,
        // Tính tỷ lệ đầy
        fillPercentage: Math.round(
          (group.members.length / group.maxMembers) * 100
        ),
        // User role luôn là ADMIN vì là creator
        userRole: 'ADMIN',
      };
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách nhóm đã tạo thành công',
      data: {
        groups: groupsWithStats,
        totalGroups: groups.length,
      },
    });
  } catch (error) {
    console.error('Get my groups error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách nhóm đã tạo',
      data: null,
    });
  }
};

// Lấy thống kê nhóm của user
exports.getUserGroupStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Đếm tổng số nhóm đã tham gia
    const totalJoinedGroups = await Group.countDocuments({
      'members.userId': userId,
    });

    // Đếm nhóm mà user là admin
    const adminGroups = await Group.countDocuments({
      members: {
        $elemMatch: {
          userId: userId,
          isAdmin: true,
        },
      },
    });

    // Đếm nhóm mà user đã tạo
    const createdGroups = await Group.countDocuments({ createdBy: userId });

    // Lấy nhóm hoạt động gần đây nhất
    const recentGroups = await Group.find({ 'members.userId': userId })
      .populate('createdBy', 'name avatar')
      .populate('interests', 'name emoji')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name description members createdBy interests updatedAt');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thống kê nhóm thành công',
      data: {
        totalJoinedGroups,
        adminGroups,
        createdGroups,
        memberGroups: totalJoinedGroups - adminGroups,
        recentGroups: recentGroups.map((group) => {
          // Xác định userRole cho user hiện tại trong nhóm này
          let userRole = 'MEMBER';

          // Nếu user là creator thì là ADMIN
          if (group.createdBy._id.toString() === userId.toString()) {
            userRole = 'ADMIN';
          } else {
            // Kiểm tra trong members xem user có isAdmin = true không
            const userMember = group.members.find(
              (member) => member.userId.toString() === userId.toString()
            );
            if (userMember?.isAdmin) {
              userRole = 'ADMIN';
            }
          }

          return {
            ...group.toObject(),
            memberCount: group.members.length,
            userRole,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Get user group stats error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy thống kê nhóm',
      data: null,
    });
  }
};

// Lấy tất cả các yêu cầu tham gia nhóm mà user đã gửi
exports.getAllJoinRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query; // PENDING, ACCEPTED, REJECTED

    // Tạo query filter
    const query = { userId };
    if (status) {
      query.status = status;
    }

    // Lấy tất cả join requests của user
    const joinRequests = await JoinGroupRequest.find(query)
      .populate('userId', 'name avatar email')
      .populate({
        path: 'groupId',
        select: 'name description members interests maxMembers createdBy',
        populate: [
          {
            path: 'createdBy',
            select: 'name avatar email',
          },
          {
            path: 'interests',
            select: 'name emoji',
          },
        ],
      })
      .sort({ createdAt: -1 });

    // Thêm thông tin thống kê cho mỗi request
    const requestsWithStats = joinRequests.map((request) => {
      const group = request.groupId;
      return {
        ...request.toObject(),
        groupStats: {
          memberCount: group?.members?.length || 0,
          maxMembers: group?.maxMembers || 0,
          fillPercentage: group
            ? Math.round((group.members.length / group.maxMembers) * 100)
            : 0,
        },
      };
    });

    // Thống kê tổng quan
    const [pendingCount, acceptedCount, rejectedCount] = await Promise.all([
      JoinGroupRequest.countDocuments({ userId, status: 'PENDING' }),
      JoinGroupRequest.countDocuments({ userId, status: 'ACCEPTED' }),
      JoinGroupRequest.countDocuments({ userId, status: 'REJECTED' }),
    ]);

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu tham gia nhóm thành công',
      data: {
        joinRequests: requestsWithStats,
        stats: {
          pending: pendingCount,
          accepted: acceptedCount,
          rejected: rejectedCount,
          total: pendingCount + acceptedCount + rejectedCount,
        },
      },
    });
  } catch (error) {
    console.error('Get all join requests error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách yêu cầu tham gia nhóm',
      data: null,
    });
  }
};
