const User = require('../models/User');
const Interest = require('../models/Interest');
const { generateToken } = require('../utils/auth');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate('interests', 'name emoji');
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get all users successfully',
      data: users,
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
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).populate('interests', 'name emoji');
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'User not found',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get user by id successfully',
      data: user,
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
exports.setUserInterests = async (req, res) => {
  const { id } = req.params;
  const { interests } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }

    if (!Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Vui lòng chọn ít nhất một sở thích',
        data: null,
      });
    }

    const validInterests = await Interest.find({
      _id: { $in: interests },
    });

    if (validInterests.length !== interests.length) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Một số sở thích không hợp lệ',
        data: null,
      });
    }

    const accessToken = generateToken(user._id, user.role, user.email);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { interests },
      { new: true }
    ).populate('interests', 'name emoji');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật sở thích thành công',
      data: {
        user: updatedUser,
        accessToken,
      },
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
exports.updateProfile = async (req, res) => {
  const { id } = req.params;
  const { name, avatar, phone } = req.body;

  try {
    // Kiểm tra user có tồn tại không
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }

    // Chuẩn bị object update với validation
    const updateData = {};

    if (name !== undefined && name !== null) {
      const trimmedName = name.toString().trim();
      if (trimmedName.length === 0) {
        return res.status(400).json({
          status: false,
          statusCode: 400,
          message: 'Tên không được để trống',
          data: null,
        });
      }
      updateData.name = trimmedName;
    }

    if (avatar !== undefined && avatar !== null) {
      const trimmedAvatar = avatar.toString().trim();
      updateData.avatar = trimmedAvatar;
    }

    if (phone !== undefined && phone !== null) {
      const trimmedPhone = phone.toString().trim();
      if (trimmedPhone.length > 0) {
        // Validation cơ bản cho số điện thoại
        const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
        if (!phoneRegex.test(trimmedPhone)) {
          return res.status(400).json({
            status: false,
            statusCode: 400,
            message: 'Số điện thoại không hợp lệ',
            data: null,
          });
        }
        updateData.phone = trimmedPhone;
      }
    }

    // Kiểm tra có dữ liệu để update không
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Không có dữ liệu để cập nhật',
        data: null,
      });
    }

    // Cập nhật user và populate interests
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('interests', 'name emoji');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật thông tin người dùng thành công',
      data: updatedUser,
    });
  } catch (error) {
    console.log('ERROR updateProfile:', error);

    // Xử lý validation errors từ mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: messages.join(', '),
        data: null,
      });
    }

    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.banUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isBanned: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái người dùng thành công',
      data: user,
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
exports.unbanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isBanned: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái người dùng thành công',
      data: user,
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
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('interests', 'name emoji')
      .populate('documents', 'title interests')
      .populate('groups', 'name');

    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin người dùng thành công',
      data: user,
    });
  } catch (error) {
    console.log('ERROR get profile:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

exports.getSellerStatistics = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { period } = req.query; // 'week', 'month', 'year' hoặc không có (all time)

    // Import models
    const Document = require('../models/Document');
    const Enrollment = require('../models/Enrollment');
    const Payment = require('../models/Payment');
    const SellerWallet = require('../models/SellerWallet');
    const WithdrawalRequest = require('../models/WithdrawalRequest');

    // Tính toán khoảng thời gian
    let dateFilter = {};
    const now = new Date(Date.now());

    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: monthAgo } };
    } else if (period === 'year') {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: yearAgo } };
    }

    // 1. Thống kê documents
    const totalDocuments = await Document.countDocuments({ author: sellerId });
    const approvedDocuments = await Document.countDocuments({
      author: sellerId,
      status: 'approved',
    });
    const pendingDocuments = await Document.countDocuments({
      author: sellerId,
      status: 'pending',
    });
    const rejectedDocuments = await Document.countDocuments({
      author: sellerId,
      status: 'rejected',
    });

    // 2. Lấy danh sách tài liệu của seller
    const sellerDocuments = await Document.find({ author: sellerId }).select(
      '_id price'
    );
    const documentIds = sellerDocuments.map((doc) => doc._id);

    // 3. Thống kê enrollments (sales)
    const enrollmentQuery = { documentId: { $in: documentIds }, ...dateFilter };
    const totalSales = await Enrollment.countDocuments({
      documentId: { $in: documentIds },
    });
    const periodSales = await Enrollment.countDocuments(enrollmentQuery);

    // 4. Thống kê revenue từ payments
    const paymentQuery = {
      documentId: { $in: documentIds },
      status: 'completed',
      ...dateFilter,
    };

    const revenueAggregation = await Payment.aggregate([
      { $match: { documentId: { $in: documentIds }, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$sellerAmount' },
          totalPayments: { $sum: 1 },
        },
      },
    ]);

    const periodRevenueAggregation = await Payment.aggregate([
      { $match: paymentQuery },
      {
        $group: {
          _id: null,
          periodRevenue: { $sum: '$sellerAmount' },
          periodPayments: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = revenueAggregation[0]?.totalRevenue || 0;
    const totalPayments = revenueAggregation[0]?.totalPayments || 0;
    const periodRevenue = periodRevenueAggregation[0]?.periodRevenue || 0;
    const periodPayments = periodRevenueAggregation[0]?.periodPayments || 0;

    // 5. Thống kê wallet
    const sellerWallet = await SellerWallet.findOne({ sellerId });
    const walletData = sellerWallet
      ? {
          availableBalance: sellerWallet.availableBalance,
          pendingBalance: sellerWallet.pendingBalance,
          totalEarned: sellerWallet.totalEarned,
          totalWithdrawn: sellerWallet.totalWithdrawn,
        }
      : {
          availableBalance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        };

    // 6. Thống kê withdrawal requests
    const totalWithdrawals = await WithdrawalRequest.countDocuments({
      sellerId,
    });
    const pendingWithdrawals = await WithdrawalRequest.countDocuments({
      sellerId,
      status: 'pending',
    });
    const approvedWithdrawals = await WithdrawalRequest.countDocuments({
      sellerId,
      status: 'approved',
    });

    // 7. Thống kê feedback/rating
    const documentsWithFeedback = await Document.find({
      author: sellerId,
      'feedback.0': { $exists: true },
    }).select('feedback');

    let totalRating = 0;
    let totalFeedbacks = 0;

    documentsWithFeedback.forEach((doc) => {
      doc.feedback.forEach((feedback) => {
        if (feedback.rating) {
          totalRating += feedback.rating;
          totalFeedbacks++;
        }
      });
    });

    const averageRating =
      totalFeedbacks > 0 ? (totalRating / totalFeedbacks).toFixed(1) : 0;

    // 8. Top performing documents
    const topDocuments = await Payment.aggregate([
      {
        $match: {
          documentId: { $in: documentIds },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$documentId',
          revenue: { $sum: '$sellerAmount' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'documents',
          localField: '_id',
          foreignField: '_id',
          as: 'document',
        },
      },
      {
        $project: {
          documentId: '$_id',
          title: { $arrayElemAt: ['$document.title', 0] },
          revenue: 1,
          sales: 1,
        },
      },
    ]);

    // 9. Thống kê theo thời gian (7 ngày gần nhất)
    const dailyStats = await Payment.aggregate([
      {
        $match: {
          documentId: { $in: documentIds },
          status: 'completed',
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          revenue: { $sum: '$sellerAmount' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thống kê seller thành công',
      data: {
        overview: {
          totalDocuments,
          approvedDocuments,
          pendingDocuments,
          rejectedDocuments,
          totalSales,
          periodSales,
          totalRevenue,
          periodRevenue,
          totalPayments,
          periodPayments,
          averageRating: parseFloat(averageRating),
          totalFeedbacks,
        },
        wallet: walletData,
        withdrawals: {
          total: totalWithdrawals,
          pending: pendingWithdrawals,
          approved: approvedWithdrawals,
        },
        topDocuments,
        dailyStats: dailyStats.map((stat) => ({
          date: `${stat._id.year}-${String(stat._id.month).padStart(
            2,
            '0'
          )}-${String(stat._id.day).padStart(2, '0')}`,
          revenue: stat.revenue,
          sales: stat.sales,
        })),
        period: period || 'all',
      },
    });
  } catch (error) {
    console.log('ERROR get seller statistics:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};

exports.getManagerStatistics = async (req, res) => {
  try {
    const { period } = req.query; // 'week', 'month', 'year' hoặc không có (all time)

    // Import models
    const Document = require('../models/Document');
    const Enrollment = require('../models/Enrollment');
    const Payment = require('../models/Payment');
    const Commission = require('../models/Commission');
    const SellerWallet = require('../models/SellerWallet');
    const PlatformWallet = require('../models/PlatformWallet');
    const WithdrawalRequest = require('../models/WithdrawalRequest');
    const Interest = require('../models/Interest');

    // Tính toán khoảng thời gian
    let dateFilter = {};
    const now = new Date(Date.now());

    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: monthAgo } };
    } else if (period === 'year') {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: yearAgo } };
    }

    // 1. User Statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isBanned: false });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const newUsers = await User.countDocuments(dateFilter);

    // Thống kê user theo role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    // 2. Document Statistics
    const totalDocuments = await Document.countDocuments();
    const approvedDocuments = await Document.countDocuments({
      status: 'approved',
    });
    const pendingDocuments = await Document.countDocuments({
      status: 'pending',
    });
    const rejectedDocuments = await Document.countDocuments({
      status: 'rejected',
    });
    const newDocuments = await Document.countDocuments(dateFilter);
    const freeDocuments = await Document.countDocuments({ isFree: true });
    const paidDocuments = await Document.countDocuments({ isFree: false });

    // Top document categories (interests)
    const topCategories = await Document.aggregate([
      { $unwind: '$interests' },
      {
        $group: {
          _id: '$interests',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'interests',
          localField: '_id',
          foreignField: '_id',
          as: 'interestData',
        },
      },
      {
        $project: {
          categoryId: '$_id',
          name: { $arrayElemAt: ['$interestData.name', 0] },
          emoji: { $arrayElemAt: ['$interestData.emoji', 0] },
          count: 1,
        },
      },
    ]);

    // 3. Payment & Revenue Statistics
    const paymentQuery = { status: 'COMPLETED', ...dateFilter };
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({
      status: 'COMPLETED',
    });
    const pendingPayments = await Payment.countDocuments({ status: 'PENDING' });
    const failedPayments = await Payment.countDocuments({ status: 'FAILED' });
    const periodPayments = await Payment.countDocuments(paymentQuery);

    // Revenue aggregation
    const [revenueData, periodRevenueData, commissionData] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'COMPLETED' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            sellerRevenue: { $sum: '$sellerAmount' },
            platformRevenue: { $sum: '$platformAmount' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: paymentQuery },
        {
          $group: {
            _id: null,
            periodRevenue: { $sum: '$amount' },
            periodSellerRevenue: { $sum: '$sellerAmount' },
            periodPlatformRevenue: { $sum: '$platformAmount' },
          },
        },
      ]),
      Commission.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$platformAmount' },
          },
        },
      ]),
    ]);

    const revenue = revenueData[0] || {
      totalRevenue: 0,
      sellerRevenue: 0,
      platformRevenue: 0,
    };
    const periodRevenue = periodRevenueData[0] || {
      periodRevenue: 0,
      periodSellerRevenue: 0,
      periodPlatformRevenue: 0,
    };

    // 5. Withdrawal Statistics
    const totalWithdrawals = await WithdrawalRequest.countDocuments();
    const pendingWithdrawals = await WithdrawalRequest.countDocuments({
      status: 'PENDING',
    });
    const approvedWithdrawals = await WithdrawalRequest.countDocuments({
      status: 'APPROVED',
    });
    const rejectedWithdrawals = await WithdrawalRequest.countDocuments({
      status: 'REJECTED',
    });

    const [totalWithdrawalAmount, pendingWithdrawalAmount] = await Promise.all([
      WithdrawalRequest.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      WithdrawalRequest.aggregate([
        { $match: { status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    // 6. Enrollment Statistics
    const totalEnrollments = await Enrollment.countDocuments();
    const periodEnrollments = await Enrollment.countDocuments(dateFilter);
    const freeEnrollments = await Enrollment.aggregate([
      {
        $lookup: {
          from: 'documents',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document',
        },
      },
      {
        $match: {
          'document.isFree': true,
        },
      },
      { $count: 'total' },
    ]);

    // 7. Top Selling Documents
    const topSellingDocuments = await Payment.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: '$documentId',
          revenue: { $sum: '$amount' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'documents',
          localField: '_id',
          foreignField: '_id',
          as: 'document',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'document.author',
          foreignField: '_id',
          as: 'author',
        },
      },
      {
        $project: {
          documentId: '$_id',
          title: { $arrayElemAt: ['$document.title', 0] },
          price: { $arrayElemAt: ['$document.price', 0] },
          authorName: { $arrayElemAt: ['$author.name', 0] },
          revenue: 1,
          sales: 1,
        },
      },
    ]);

    // 8. Top Sellers
    const topSellers = await Payment.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: '$sellerId',
          totalRevenue: { $sum: '$sellerAmount' },
          totalSales: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'seller',
        },
      },
      {
        $project: {
          sellerId: '$_id',
          name: { $arrayElemAt: ['$seller.name', 0] },
          email: { $arrayElemAt: ['$seller.email', 0] },
          avatar: { $arrayElemAt: ['$seller.avatar', 0] },
          totalRevenue: 1,
          totalSales: 1,
        },
      },
    ]);

    // 9. Daily Revenue Stats (30 ngày gần nhất)
    const dailyRevenueStats = await Payment.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          revenue: { $sum: '$amount' },
          platformRevenue: { $sum: '$platformAmount' },
          sellerRevenue: { $sum: '$sellerAmount' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // 10. Recent Activities
    const recentDocuments = await Document.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('author', 'name email avatar')
      .select('title status createdAt author');

    const recentPayments = await Payment.find({ status: 'COMPLETED' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email avatar')
      .populate('documentId', 'title')
      .select('amount createdAt userId documentId');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thống kê manager thành công',
      data: {
        overview: {
          users: {
            total: totalUsers,
            active: activeUsers,
            banned: bannedUsers,
            new: newUsers,
            byRole: usersByRole,
          },
          documents: {
            total: totalDocuments,
            approved: approvedDocuments,
            pending: pendingDocuments,
            rejected: rejectedDocuments,
            new: newDocuments,
            free: freeDocuments,
            paid: paidDocuments,
          },
          payments: {
            total: totalPayments,
            completed: completedPayments,
            pending: pendingPayments,
            failed: failedPayments,
            period: periodPayments,
          },
          enrollments: {
            total: totalEnrollments,
            period: periodEnrollments,
            free: freeEnrollments[0]?.total || 0,
            paid: totalEnrollments - (freeEnrollments[0]?.total || 0),
          },
        },
        revenue: {
          ...revenue,
          ...periodRevenue,
        },
        withdrawals: {
          total: totalWithdrawals,
          pending: pendingWithdrawals,
          approved: approvedWithdrawals,
          rejected: rejectedWithdrawals,
          totalAmount: totalWithdrawalAmount[0]?.total || 0,
          pendingAmount: pendingWithdrawalAmount[0]?.total || 0,
        },
        commissions: commissionData,
        topCategories,
        topSellingDocuments,
        topSellers,
        dailyRevenueStats: dailyRevenueStats.map((stat) => ({
          date: `${stat._id.year}-${String(stat._id.month).padStart(
            2,
            '0'
          )}-${String(stat._id.day).padStart(2, '0')}`,
          revenue: stat.revenue,
          platformRevenue: stat.platformRevenue,
          sellerRevenue: stat.sellerRevenue,
          sales: stat.sales,
        })),
        recentActivities: {
          documents: recentDocuments,
          payments: recentPayments,
        },
        period: period || 'all',
      },
    });
  } catch (error) {
    console.log('ERROR get manager statistics:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
