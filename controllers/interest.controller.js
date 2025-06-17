const Interest = require('../models/Interest');
const User = require('../models/User');
const Document = require('../models/Document');
const { normalizeString } = require('../utils');
const Group = require('../models/Group');

exports.getAllInterests = async (req, res) => {
  try {
    const interests = await Interest.find();
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get all interests successfully',
      data: interests,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
    });
  }
};
exports.getMyInterests = async (req, res) => {
  try {
    const userId = req.user._id;
    const userInterests = await User.findById(userId).populate('interests');
    const interests = await Interest.find({
      _id: { $in: userInterests.interests },
    });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get my interests successfully',
      data: interests,
    });
  } catch (error) {
    console.log('ERROR', error);
  }
};
exports.createInterest = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Tên sở thích không được để trống',
        data: null,
      });
    }

    const normalizedName = normalizeString(name);

    // Tìm tất cả các interest có tên chuẩn hóa trùng nhau
    const existingInterests = await Interest.find({});
    const isDuplicate = existingInterests.some(
      (interest) => normalizeString(interest.name) === normalizedName
    );

    if (isDuplicate) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Sở thích này đã tồn tại',
        data: null,
      });
    }

    const interest = await Interest.create({ name });

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo sở thích thành công',
      data: interest,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.updateInterest = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const interest = await Interest.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

    if (!interest) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Sở thích không tồn tại',
        data: null,
      });
    }

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật sở thích thành công',
      data: interest,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.getRecommendedDocsUsersGroups = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { minSharedInterests = 3, limit = 10 } = req.query;

    // Lấy thông tin user hiện tại với interests
    const currentUser = await User.findById(currentUserId)
      .populate('interests', 'name emoji')
      .select('interests name email avatar');

    if (
      !currentUser ||
      !currentUser.interests ||
      currentUser.interests.length === 0
    ) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'User chưa có sở thích nào được thiết lập',
        data: {
          recommendedDocuments: [],
          recommendedUsers: [],
          recommendedGroups: [],
          userInterests: [],
        },
      });
    }

    const userInterestIds = currentUser.interests.map(
      (interest) => interest._id
    );

    // Tìm tài liệu có chung ít nhất minSharedInterests sở thích
    const recommendedDocuments = await Document.aggregate([
      {
        $match: {
          author: { $ne: currentUserId }, // Không bao gồm tài liệu của chính user
          status: 'APPROVED',
          interests: { $in: userInterestIds },
        },
      },
      {
        $addFields: {
          sharedInterestsCount: {
            $size: {
              $setIntersection: ['$interests', userInterestIds],
            },
          },
        },
      },
      {
        $match: {
          sharedInterestsCount: { $gte: parseInt(minSharedInterests) },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorInfo',
          pipeline: [{ $project: { name: 1, avatar: 1, email: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interestDetails',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ['$authorInfo', 0] },
          matchPercentage: {
            $multiply: [
              { $divide: ['$sharedInterestsCount', userInterestIds.length] },
              100,
            ],
          },
        },
      },
      {
        $sort: {
          sharedInterestsCount: -1,
          createdAt: -1,
        },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          title: 1,
          description: 1,
          price: 1,
          discount: 1,
          imageUrl: 1,
          author: 1,
          sharedInterestsCount: 1,
          matchPercentage: 1,
          createdAt: 1,
        },
      },
    ]);

    // Tìm user có chung ít nhất minSharedInterests sở thích
    const recommendedUsers = await User.aggregate([
      {
        $match: {
          _id: { $ne: currentUserId },
          isBanned: false,
          interests: { $in: userInterestIds },
        },
      },
      {
        $addFields: {
          sharedInterestsCount: {
            $size: {
              $setIntersection: ['$interests', userInterestIds],
            },
          },
        },
      },
      {
        $match: {
          sharedInterestsCount: { $gte: parseInt(minSharedInterests) },
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interestDetails',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $addFields: {
          matchPercentage: {
            $multiply: [
              { $divide: ['$sharedInterestsCount', userInterestIds.length] },
              100,
            ],
          },
        },
      },
      {
        $sort: {
          sharedInterestsCount: -1,
          createdAt: -1,
        },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          name: 1,
          email: 1,
          avatar: 1,
          sharedInterestsCount: 1,
          matchPercentage: 1,
          createdAt: 1,
        },
      },
    ]);

    // Tìm groups có chung ít nhất minSharedInterests sở thích
    const recommendedGroups = await Group.aggregate([
      {
        $match: {
          // Không lấy groups mà user đã là thành viên
          'members.userId': { $ne: currentUserId },
          interests: { $in: userInterestIds },
        },
      },
      {
        $addFields: {
          sharedInterestsCount: {
            $size: {
              $setIntersection: ['$interests', userInterestIds],
            },
          },
          currentMemberCount: { $size: '$members' },
        },
      },
      {
        $match: {
          sharedInterestsCount: { $gte: parseInt(minSharedInterests) },
          // Chỉ lấy groups chưa đầy
          $expr: { $lt: ['$currentMemberCount', '$maxMembers'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
          pipeline: [{ $project: { name: 1, avatar: 1, email: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interestDetails',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ['$createdBy', 0] },
          matchPercentage: {
            $multiply: [
              { $divide: ['$sharedInterestsCount', userInterestIds.length] },
              100,
            ],
          },
          // Tính compatibility score
          compatibilityScore: {
            $multiply: [
              '$sharedInterestsCount',
              {
                $cond: {
                  if: {
                    $lt: [
                      '$currentMemberCount',
                      { $multiply: ['$maxMembers', 0.8] },
                    ],
                  },
                  then: 1.2, // Bonus cho groups còn nhiều chỗ trống
                  else: 1.0,
                },
              },
            ],
          },
        },
      },
      {
        $sort: {
          compatibilityScore: -1,
          sharedInterestsCount: -1,
          createdAt: -1,
        },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          name: 1,
          description: 1,
          createdBy: 1,
          maxMembers: 1,
          currentMemberCount: 1,
          sharedInterestsCount: 1,
          matchPercentage: 1,
          compatibilityScore: 1,
          createdAt: 1,
          interestDetails: 1,
        },
      },
    ]);

    // Thống kê thêm
    const totalDocuments = await Document.countDocuments({
      author: { $ne: currentUserId },
      status: 'APPROVED',
    });

    const totalUsers = await User.countDocuments({
      _id: { $ne: currentUserId },
      isBanned: false,
    });

    const totalGroups = await Group.countDocuments({
      'members.userId': { $ne: currentUserId },
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy đề xuất thành công',
      data: {
        recommendedDocuments: {
          items: recommendedDocuments,
          count: recommendedDocuments.length,
          totalAvailable: totalDocuments,
        },
        recommendedUsers: {
          items: recommendedUsers,
          count: recommendedUsers.length,
          totalAvailable: totalUsers,
        },
        recommendedGroups: {
          items: recommendedGroups,
          count: recommendedGroups.length,
          totalAvailable: totalGroups,
        },
        searchCriteria: {
          minSharedInterests: parseInt(minSharedInterests),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy đề xuất',
      data: null,
    });
  }
};
exports.getPriorityDocuments = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 12, isFree } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy interests của user hiện tại
    const currentUser = await User.findById(currentUserId).select('interests');
    const userInterestIds = currentUser?.interests || [];

    // Không cần điều kiện tối thiểu, lấy tất cả và sắp xếp theo ưu tiên

    // Build match conditions
    const matchConditions = {
      status: 'APPROVED',
      author: { $ne: currentUserId },
    };

    // Add isFree filter if specified
    if (isFree !== undefined) {
      matchConditions.isFree = isFree === 'true';
    }

    // Lấy documents với ưu tiên theo interests chung
    const documents = await Document.aggregate([
      {
        $match: matchConditions,
      },
      {
        $addFields: {
          sharedInterests: {
            $setIntersection: ['$interests', userInterestIds],
          },
        },
      },
      {
        $addFields: {
          // Tính số interests chung
          sharedInterestsCount: {
            $size: '$sharedInterests',
          },
          // Tính tỷ lệ phần trăm phù hợp
          matchPercentage: {
            $multiply: [
              {
                $divide: [
                  { $size: '$sharedInterests' },
                  { $literal: userInterestIds.length },
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $sort: {
          sharedInterestsCount: -1, // Ưu tiên theo interests chung
          createdAt: -1, // Sau đó theo thời gian
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { name: 1, avatar: 1, email: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interests',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ['$author', 0] },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          price: 1,
          discount: 1,
          isFree: 1,
          imageUrls: 1,
          author: 1,
          interests: 1,
          sharedInterestsCount: 1,
          matchPercentage: { $round: ['$matchPercentage', 1] },
          createdAt: 1,
        },
      },
    ]);

    // Count total documents
    const totalDocumentsCount = await Document.aggregate([
      { $match: matchConditions },
      {
        $addFields: {
          sharedInterests: {
            $setIntersection: ['$interests', userInterestIds],
          },
        },
      },
      {
        $addFields: {
          sharedInterestsCount: { $size: '$sharedInterests' },
        },
      },
      {
        $count: 'total',
      },
    ]);

    const totalDocuments = totalDocumentsCount[0]?.total || 0;
    const totalPages = Math.ceil(totalDocuments / parseInt(limit));

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách documents theo ưu tiên thành công',
      data: {
        documents,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDocuments,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách documents',
      data: null,
    });
  }
};
exports.getPriorityUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 12, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy interests của user hiện tại
    const currentUser = await User.findById(currentUserId)
      .select('interests')
      .populate('interests', 'name emoji');
    const userInterestIds =
      currentUser?.interests?.map((interest) => interest._id) || [];

    // Không cần điều kiện tối thiểu, lấy tất cả và sắp xếp theo ưu tiên

    // Build match conditions
    const matchConditions = {
      _id: { $ne: currentUserId }, // Loại bỏ user hiện tại
      isVerified: true, // Chỉ lấy user đã verified
      isBanned: false, // Loại bỏ user bị ban
      interests: { $exists: true, $ne: [] }, // Phải có interests
    };

    // Add role filter if specified
    if (role) {
      matchConditions.role = role;
    }

    // Lấy users với ưu tiên theo interests chung
    const users = await User.aggregate([
      {
        $match: matchConditions,
      },
      {
        $addFields: {
          sharedInterests: {
            $setIntersection: ['$interests', userInterestIds],
          },
        },
      },
      {
        $addFields: {
          // Tính số interests chung
          sharedInterestsCount: {
            $size: '$sharedInterests',
          },
          // Tính tỷ lệ phần trăm phù hợp
          matchPercentage: {
            $multiply: [
              {
                $divide: [
                  { $size: '$sharedInterests' },
                  { $literal: userInterestIds.length },
                ],
              },
              100,
            ],
          },
        },
      },

      {
        $sort: {
          sharedInterestsCount: -1, // Ưu tiên theo interests chung
          createdAt: -1, // Sau đó theo thời gian tham gia
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interests',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          avatar: 1,
          interests: 1,
          sharedInterestsCount: 1,
          matchPercentage: { $round: ['$matchPercentage', 1] },
          createdAt: 1,
        },
      },
    ]);

    // Count total users
    const totalUsersCount = await User.aggregate([
      { $match: matchConditions },
      {
        $addFields: {
          sharedInterests: {
            $setIntersection: ['$interests', userInterestIds],
          },
        },
      },
      {
        $addFields: {
          sharedInterestsCount: { $size: '$sharedInterests' },
        },
      },
      {
        $count: 'total',
      },
    ]);

    const totalUsers = totalUsersCount[0]?.total || 0;
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách users theo ưu tiên thành công',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách users',
      data: null,
    });
  }
};
exports.getPriorityGroups = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy interests của user hiện tại
    const currentUser = await User.findById(currentUserId).select('interests');
    const userInterestIds = currentUser?.interests || [];

    // Không cần điều kiện tối thiểu, lấy tất cả và sắp xếp theo ưu tiên

    // Lấy tất cả groups và sắp xếp theo interests chung
    const groups = await Group.aggregate([
      {
        $addFields: {
          // Tính số interests chung
          sharedInterestsCount: {
            $size: {
              $setIntersection: ['$interests', userInterestIds],
            },
          },
          // Số lượng thành viên hiện tại
          currentMemberCount: { $size: '$members' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
          pipeline: [{ $project: { name: 1, avatar: 1, email: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interests',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ['$createdBy', 0] },
          // Tính compatibility score (có thể mở rộng thêm logic)
          compatibilityScore: {
            $multiply: [
              '$sharedInterestsCount',
              // Ưu tiên groups chưa đầy thành viên
              {
                $cond: {
                  if: { $lt: ['$currentMemberCount', '$maxMembers'] },
                  then: 1.2,
                  else: 0.8,
                },
              },
            ],
          },
        },
      },
      {
        $sort: {
          compatibilityScore: -1, // Sắp xếp theo độ phù hợp
          sharedInterestsCount: -1, // Sau đó theo số interests chung
          createdAt: -1, // Cuối cùng theo thời gian tạo
        },
      },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          description: 1,
          createdBy: 1,
          interests: 1,
          maxMembers: 1,
          currentMemberCount: 1,
          sharedInterestsCount: 1,
          compatibilityScore: 1,
          createdAt: 1,
          // Thêm flag cho biết user đã join chưa
          isMember: {
            $in: [currentUserId, '$members.userId'],
          },
        },
      },
    ]);

    // Đếm tổng số groups (cho phân trang)
    const totalCountResult = await Group.aggregate([
      {
        $addFields: {
          sharedInterestsCount: {
            $size: {
              $setIntersection: ['$interests', userInterestIds],
            },
          },
        },
      },
      {
        $count: 'total',
      },
    ]);

    const totalCount = totalCountResult[0]?.total || 0;

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách groups theo ưu tiên thành công',
      data: {
        groups,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
        },
        userInterestsCount: userInterestIds.length,
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách groups',
      data: null,
    });
  }
};
