const Interest = require('../models/Interest');
const User = require('../models/User');
const Document = require('../models/Document');
const { normalizeString } = require('../utils');

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
exports.getRecommendedDocumentsAndUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { minSharedInterests = 2, limit = 10 } = req.query;

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
          isPublic: true,
          isBanned: false,
          isDeleted: false,
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
          isDeleted: false,
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

    // Thống kê thêm
    const totalDocuments = await Document.countDocuments({
      author: { $ne: currentUserId },
      isPublic: true,
      isBanned: false,
      isDeleted: false,
    });

    const totalUsers = await User.countDocuments({
      _id: { $ne: currentUserId },
      isBanned: false,
      isDeleted: false,
    });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy đề xuất thành công',
      data: {
        userInfo: {
          name: currentUser.name,
          interests: currentUser.interests,
          totalInterests: currentUser.interests.length,
        },
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
