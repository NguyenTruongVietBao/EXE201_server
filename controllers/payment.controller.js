const Document = require('../models/Document');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const SellerWallet = require('../models/SellerWallet');
const PlatformWallet = require('../models/PlatformWallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { createPayment } = require('../configs/payos');

const COMMISSION_RATE = 0.15; // 15% commission

exports.buyDocument = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if document exists
    const document = await Document.findById(id).populate('author');
    if (!document) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy khóa học',
        data: null,
      });
    }

    // Check if document is approved
    if (document.status !== 'APPROVED') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Khóa học chưa được phê duyệt',
        data: null,
      });
    }

    // Check if user has already bought this document
    const hasBought = await Enrollment.findOne({
      documentId: document._id,
      userId: req.user._id,
    });
    if (hasBought) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Bạn đã sở hữu khóa học này',
        data: null,
      });
    }

    // Check if user is the seller
    if (document.author._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Bạn không thể mua khóa học của chính mình',
        data: null,
      });
    }

    // Create payment record
    const finalPrice = Number(document.price * (1 - document.discount / 100));
    const payment = new Payment({
      userId: req.user._id,
      documentId: document._id,
      sellerId: document.author._id,
      amount: finalPrice,
      status: 'PENDING',
    });
    await payment.save();

    // Create payment link with payment ID
    const paymentData = {
      ...document.toObject(),
      paymentId: payment._id,
    };
    const paymentLink = await createPayment(paymentData, req.user, finalPrice);
    console.log('🚀 ~ exports.buyDocument= ~ paymentLink:', paymentLink);

    if (!paymentLink) {
      payment.status = 'FAILED';
      await payment.save();
      return res.status(500).json({
        status: false,
        statusCode: 500,
        message: 'Không thể tạo liên kết thanh toán',
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Tạo liên kết thanh toán thành công',
      data: { paymentLink, paymentId: payment._id },
    });
  } catch (error) {
    console.error('🚀 ~ buyDocument error:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const id = req.user._id;
    const payment = await Payment.find({ userId: id }).populate('documentId');
    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách thanh toán thành công',
      data: payment,
    });
  } catch (error) {
    console.error('ERROR getPayment:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Xử lý callback từ PayOS
exports.handlePaymentCallback = async (req, res) => {
  try {
    const { documentId, code, cancel, status, orderCode, paymentId } = req.body;

    if (code !== '00' || status !== 'PAID' || cancel === 'true') {
      // Payment failed or cancelled
      if (paymentId) {
        await Payment.findByIdAndUpdate(paymentId, {
          status: 'FAILED',
          transactionCode: orderCode || '',
        });
      }
      return res.status(200).json({
        status: true,
        statusCode: 200,
        message: 'Thanh toán thất bại',
        data: null,
      });
    }

    // Find payment record
    const payment = await Payment.findById(paymentId)
      .populate('documentId')
      .populate('sellerId')
      .populate('userId');

    if (!payment) {
      return res.status(200).json({
        status: true,
        statusCode: 200,
        message: 'Thanh toán thất bại',
        data: null,
      });
    }

    if (payment.status === 'COMPLETED') {
      // Already processed
      return res.status(200).json({
        status: true,
        statusCode: 200,
        message: 'Thanh toán thành công',
        data: null,
      });
    }

    // Update payment status
    payment.status = 'COMPLETED';
    payment.transactionCode = orderCode;
    await payment.save();

    // Create enrollment
    const enrollment = new Enrollment({
      userId: payment.userId._id,
      documentId: payment.documentId._id,
    });
    await enrollment.save();

    // Update document download count
    // await Document.findByIdAndUpdate(payment.documentId._id, {
    //   $inc: { download: 1 },
    // });

    // Calculate commission
    const totalAmount = payment.amount;
    const platformAmount = Math.floor(totalAmount * COMMISSION_RATE);
    const sellerAmount = totalAmount - platformAmount;

    // Create commission record
    const commission = new Commission({
      paymentId: payment._id,
      sellerId: payment.sellerId._id,
      platformFee: COMMISSION_RATE,
      sellerAmount,
      platformAmount,
      status: 'PENDING',
      releaseDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await commission.save();

    // Update or create seller wallet
    let sellerWallet = await SellerWallet.findOne({
      sellerId: payment.sellerId._id,
    });
    if (!sellerWallet) {
      sellerWallet = new SellerWallet({
        sellerId: payment.sellerId._id,
        pendingBalance: sellerAmount,
        totalEarned: sellerAmount,
      });
    } else {
      sellerWallet.pendingBalance += sellerAmount;
      sellerWallet.totalEarned += sellerAmount;
    }
    await sellerWallet.save();

    // Update or create platform wallet
    let platformWallet = await PlatformWallet.findOne();
    if (!platformWallet) {
      platformWallet = new PlatformWallet({
        totalBalance: platformAmount,
        availableBalance: 0,
        pendingBalance: platformAmount,
        totalCommissionEarned: platformAmount,
      });
    } else {
      platformWallet.totalBalance += platformAmount;
      platformWallet.pendingBalance += platformAmount;
      platformWallet.totalCommissionEarned += platformAmount;
    }
    await platformWallet.save();

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Thanh toán thành công',
      data: null,
    });
  } catch (error) {
    console.error('ERROR handlePaymentCallback:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Seller tạo yêu cầu rút tiền
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const sellerId = req.user._id;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Số tiền không hợp lệ',
        data: null,
      });
    }

    if (
      !bankDetails ||
      !bankDetails.bankName ||
      !bankDetails.bankAccountName ||
      !bankDetails.bankAccountNumber
    ) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Thông tin tài khoản ngân hàng không đầy đủ',
        data: null,
      });
    }

    // Check seller wallet
    const sellerWallet = await SellerWallet.findOne({ sellerId });
    if (!sellerWallet || sellerWallet.availableBalance < amount) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Số dư không đủ để rút tiền',
        data: null,
      });
    }

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      sellerId,
      amount,
      bankDetails,
      status: 'PENDING',
    });
    await withdrawalRequest.save();

    // Update wallet - move from available to pending
    sellerWallet.availableBalance -= amount;
    await sellerWallet.save();

    return res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Yêu cầu rút tiền đã được tạo thành công',
      data: withdrawalRequest,
    });
  } catch (error) {
    console.error('ERROR createWithdrawalRequest:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy danh sách yêu cầu rút tiền của seller với thống kê
exports.getMyWithdrawalRequests = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { status } = req.query;

    // Query cơ bản
    const query = { sellerId };
    if (status) {
      query.status = status;
    }

    // Lấy tất cả withdrawal requests (bỏ pagination)
    const withdrawalRequests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('processedBy', 'name email avatar');

    // Thống kê tổng quan
    const statistics = await WithdrawalRequest.aggregate([
      { $match: { sellerId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Tính toán thống kê chi tiết
    const stats = {
      total: await WithdrawalRequest.countDocuments({ sellerId }),
      pending: 0,
      rejected: 0,
      completed: 0,
      totalAmount: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
      completedAmount: 0,
    };

    // Xử lý dữ liệu thống kê
    statistics.forEach((stat) => {
      const status = stat._id?.toLowerCase() || 'unknown';
      const count = stat.count || 0;
      const amount = stat.totalAmount || 0;

      if (status === 'pending') {
        stats.pending = count;
        stats.pendingAmount = amount;
      } else if (status === 'rejected') {
        stats.rejected = count;
        stats.rejectedAmount = amount;
      } else if (status === 'completed') {
        stats.completed = count;
        stats.completedAmount = amount;
      }

      stats.totalAmount += amount;
    });

    // Thống kê theo thời gian (30 ngày gần nhất)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentStats = await WithdrawalRequest.aggregate([
      {
        $match: {
          sellerId,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Request gần nhất
    const latestRequest = await WithdrawalRequest.findOne({ sellerId })
      .sort({ createdAt: -1 })
      .populate('processedBy', 'name email avatar');

    // Tỷ lệ thành công
    const successRate =
      stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0;

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu rút tiền thành công',
      data: {
        withdrawalRequests,
        statistics: {
          overview: stats,
          successRate: parseFloat(successRate),
          latestRequest: latestRequest
            ? {
                id: latestRequest._id,
                amount: latestRequest.amount,
                status: latestRequest.status,
                createdAt: latestRequest.createdAt,
                processedBy: latestRequest.processedBy,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error('ERROR getMyWithdrawalRequests:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy thông tin ví của seller
exports.getSellerWallet = async (req, res) => {
  try {
    const sellerId = req.user._id;

    let sellerWallet = await SellerWallet.findOne({ sellerId });
    if (!sellerWallet) {
      sellerWallet = new SellerWallet({
        sellerId,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
      await sellerWallet.save();
    }

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin ví seller thành công',
      data: sellerWallet,
    });
  } catch (error) {
    console.error('ERROR getSellerWallet:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Cron job để release commission sau 24h
exports.releaseCommissions = async () => {
  try {
    const now = new Date(Date.now());
    const Refund = require('../models/Refund');

    const commissionsToRelease = await Commission.find({
      status: 'PENDING',
      releaseDate: { $lte: now },
    });

    for (const commission of commissionsToRelease) {
      // Kiểm tra xem có refund request nào đang pending cho payment này không
      const pendingRefund = await Refund.findOne({
        paymentId: commission.paymentId,
        status: 'PENDING',
      });

      if (pendingRefund) {
        console.log(
          `⏳ Skipping commission release for payment ${commission.paymentId} - pending refund request exists`
        );
        continue;
      }

      // Update commission status
      commission.status = 'RELEASED';
      await commission.save();

      // Move money from pending to available in seller wallet
      const sellerWallet = await SellerWallet.findOne({
        sellerId: commission.sellerId,
      });
      if (sellerWallet) {
        sellerWallet.pendingBalance -= commission.sellerAmount;
        sellerWallet.availableBalance += commission.sellerAmount;
        await sellerWallet.save();
      }

      // Move platform commission from pending to available
      const platformWallet = await PlatformWallet.findOne();
      if (platformWallet) {
        platformWallet.pendingBalance -= commission.platformAmount;
        platformWallet.availableBalance += commission.platformAmount;
        await platformWallet.save();
        console.log(
          `🏦 Released platform commission: ${commission.platformAmount} VND`
        );
      }
    }
  } catch (error) {
    console.error('ERROR releaseCommissions:', error);
  }
};

// Lấy danh sách yêu cầu rút tiền với thống kê (dành cho admin)
exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Query cơ bản
    const query = {};
    if (status) {
      query.status = status;
    }

    // Lấy tất cả withdrawal requests
    const withdrawalRequests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email avatar');

    // Thống kê tổng quan toàn hệ thống
    const statistics = await WithdrawalRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Tính toán thống kê chi tiết
    const stats = {
      total: await WithdrawalRequest.countDocuments(),
      pending: 0,
      rejected: 0,
      completed: 0,
      totalAmount: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
      completedAmount: 0,
    };

    // Xử lý dữ liệu thống kê
    statistics.forEach((stat) => {
      const status = stat._id?.toLowerCase() || 'unknown';
      const count = stat.count || 0;
      const amount = stat.totalAmount || 0;

      if (status === 'pending') {
        stats.pending = count;
        stats.pendingAmount = amount;
      } else if (status === 'rejected') {
        stats.rejected = count;
        stats.rejectedAmount = amount;
      } else if (status === 'completed') {
        stats.completed = count;
        stats.completedAmount = amount;
      }

      stats.totalAmount += amount;
    });

    // Top sellers theo số lượng withdrawal requests
    const topSellers = await WithdrawalRequest.aggregate([
      {
        $group: {
          _id: '$sellerId',
          totalRequests: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0] },
          },
        },
      },
      { $sort: { totalAmount: -1 } },
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
          sellerName: { $arrayElemAt: ['$seller.name', 0] },
          sellerEmail: { $arrayElemAt: ['$seller.email', 0] },
          sellerAvatar: { $arrayElemAt: ['$seller.avatar', 0] },
          totalRequests: 1,
          totalAmount: 1,
          completedRequests: 1,
          completedAmount: 1,
        },
      },
    ]);

    // Thống kê theo thời gian (30 ngày gần nhất)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyStats = await WithdrawalRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Request cần xử lý gấp (pending lâu nhất)
    const urgentRequests = await WithdrawalRequest.find({ status: 'PENDING' })
      .sort({ createdAt: 1 })
      .limit(5)
      .populate('sellerId', 'name email avatar');

    // Tỷ lệ thành công và processing time
    const successRate =
      stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0;

    // Tính average processing time cho các requests đã completed
    const avgProcessingTime = await WithdrawalRequest.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          updatedAt: { $exists: true },
        },
      },
      {
        $project: {
          processingTime: {
            $divide: [
              { $subtract: ['$updatedAt', '$createdAt'] },
              1000 * 60 * 60, // Convert to hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$processingTime' },
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu rút tiền thành công',
      data: {
        withdrawalRequests,
        statistics: {
          overview: stats,
          successRate: parseFloat(successRate),
          avgProcessingTime: avgProcessingTime[0]?.avgTime?.toFixed(2) || 0,
          topSellers,
          dailyStats: dailyStats.map((item) => ({
            date: `${item._id.year}-${String(item._id.month).padStart(
              2,
              '0'
            )}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count,
            amount: item.amount,
            pending: item.pending,
            completed: item.completed,
          })),
          urgentRequests: urgentRequests.map((req) => ({
            id: req._id,
            seller: req.sellerId,
            amount: req.amount,
            createdAt: req.createdAt,
            daysPending: Math.floor(
              (Date.now() - req.createdAt) / (1000 * 60 * 60 * 24)
            ),
          })),
        },
      },
    });
  } catch (error) {
    console.error('ERROR getAllWithdrawalRequests:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Xử lý yêu cầu rút tiền
exports.processWithdrawalRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user._id;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Trạng thái không hợp lệ',
        data: null,
      });
    }

    const withdrawalRequest = await WithdrawalRequest.findById(id)
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email avatar');
    if (!withdrawalRequest) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy yêu cầu rút tiền',
        data: null,
      });
    }

    if (withdrawalRequest.status !== 'PENDING') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Yêu cầu đã được xử lý',
        data: null,
      });
    }

    // Update withdrawal request
    withdrawalRequest.status = status;
    withdrawalRequest.processedBy = adminId;
    withdrawalRequest.notes = notes;
    await withdrawalRequest.save();

    const sellerWallet = await SellerWallet.findOne({
      sellerId: withdrawalRequest.sellerId,
    });

    if (status === 'APPROVED') {
      if (sellerWallet) {
        sellerWallet.totalWithdrawn += withdrawalRequest.amount;
        await sellerWallet.save();
      }

      withdrawalRequest.status = 'COMPLETED';
      await withdrawalRequest.save();
    } else if (status === 'REJECTED') {
      if (sellerWallet) {
        sellerWallet.availableBalance += withdrawalRequest.amount;
        await sellerWallet.save();
      }
    }

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: `Yêu cầu rút tiền đã được ${
        status === 'APPROVED' ? 'phê duyệt' : 'từ chối'
      }`,
      data: withdrawalRequest,
    });
  } catch (error) {
    console.error('ERROR processWithdrawalRequest:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

exports.getPlatformWallet = async (req, res) => {
  try {
    const Refund = require('../models/Refund');
    const WithdrawalRequest = require('../models/WithdrawalRequest');
    const Commission = require('../models/Commission');

    let platformWallet = await PlatformWallet.findOne();
    if (!platformWallet) {
      platformWallet = new PlatformWallet({
        totalBalance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        totalCommissionEarned: 0,
        totalRefunded: 0,
        totalWithdrawals: 0,
      });
      await platformWallet.save();
    }

    // Tính toán thời gian 24h trước
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. totalBalance: Tổng số tiền các customer đã chuyển (tất cả payments completed)
    const totalBalanceAmount = await Payment.aggregate([
      {
        $match: {
          status: 'COMPLETED',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // 2. pendingBalance: Tổng số tiền customer mua trong 24h gần nhất
    const pendingBalanceAmount = await Payment.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          createdAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // 3. totalCommissionEarned: Tổng hoa hồng 15% sau 24h customer mua
    const totalCommissionAmount = await Payment.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          createdAt: { $lt: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$platformAmount' },
        },
      },
    ]);

    // 4. totalRefunded: Tổng số tiền đã hoàn trả
    const totalRefundedAmount = await Refund.aggregate([
      {
        $match: {
          status: 'APPROVED',
          refundCompletedAt: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // 5. totalWithdrawals: Tổng số tiền đã rút
    const totalWithdrawalsAmount = await WithdrawalRequest.aggregate([
      {
        $match: {
          status: 'COMPLETED',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Tính toán các giá trị
    const calculatedTotalBalance = totalBalanceAmount[0]?.totalAmount || 0;
    const calculatedPendingBalance = pendingBalanceAmount[0]?.totalAmount || 0;
    const calculatedTotalCommission =
      totalCommissionAmount[0]?.totalAmount || 0;
    const calculatedTotalRefunded = totalRefundedAmount[0]?.totalAmount || 0;
    const calculatedTotalWithdrawals =
      totalWithdrawalsAmount[0]?.totalAmount || 0;

    // availableBalance: Số tiền platform thực sự có thể sử dụng sau khi hoàn tất mọi thứ
    // = totalCommissionEarned (hoa hồng sau 24h) - totalRefunded (đã hoàn trả)
    // Đảm bảo không bao giờ âm
    const calculatedAvailableBalance = Math.max(
      0,
      calculatedTotalCommission - calculatedTotalRefunded
    );

    // Cập nhật vào database nếu có sự khác biệt
    let shouldUpdate = false;
    const updates = {};

    if (platformWallet.totalBalance !== calculatedTotalBalance) {
      updates.totalBalance = calculatedTotalBalance;
      shouldUpdate = true;
    }

    if (platformWallet.availableBalance !== calculatedAvailableBalance) {
      updates.availableBalance = calculatedAvailableBalance;
      shouldUpdate = true;
    }

    if (platformWallet.pendingBalance !== calculatedPendingBalance) {
      updates.pendingBalance = calculatedPendingBalance;
      shouldUpdate = true;
    }

    if (platformWallet.totalCommissionEarned !== calculatedTotalCommission) {
      updates.totalCommissionEarned = calculatedTotalCommission;
      shouldUpdate = true;
    }

    if (platformWallet.totalRefunded !== calculatedTotalRefunded) {
      updates.totalRefunded = calculatedTotalRefunded;
      shouldUpdate = true;
    }

    if (platformWallet.totalWithdrawals !== calculatedTotalWithdrawals) {
      updates.totalWithdrawals = calculatedTotalWithdrawals;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      platformWallet = await PlatformWallet.findOneAndUpdate(
        {},
        { $set: updates },
        { new: true, upsert: true }
      );
    }

    // Thêm thống kê chi tiết
    const statistics = {
      // Số lượng giao dịch
      totalPaymentCount: await Payment.countDocuments({ status: 'COMPLETED' }),
      pendingPaymentCount: await Payment.countDocuments({
        status: 'COMPLETED',
        createdAt: { $gte: twentyFourHoursAgo },
      }),

      // Số lượng hoàn tiền
      totalRefundCount: await Refund.countDocuments({ status: 'APPROVED' }),
      pendingRefundCount: await Refund.countDocuments({ status: 'PENDING' }),

      // Số lượng rút tiền
      totalWithdrawalCount: await WithdrawalRequest.countDocuments({
        status: 'COMPLETED',
      }),
      pendingWithdrawalCount: await WithdrawalRequest.countDocuments({
        status: 'PENDING',
      }),

      // Tỷ lệ và thống kê khác
      refundRate:
        calculatedTotalBalance > 0
          ? ((calculatedTotalRefunded / calculatedTotalBalance) * 100).toFixed(
              2
            )
          : 0,
      withdrawalRate:
        calculatedTotalBalance > 0
          ? (
              (calculatedTotalWithdrawals / calculatedTotalBalance) *
              100
            ).toFixed(2)
          : 0,
      commissionRate:
        calculatedTotalBalance > 0
          ? (
              (calculatedTotalCommission / calculatedTotalBalance) *
              100
            ).toFixed(2)
          : 0,
      pendingRate:
        calculatedTotalBalance > 0
          ? ((calculatedPendingBalance / calculatedTotalBalance) * 100).toFixed(
              2
            )
          : 0,
      availableRate:
        calculatedTotalBalance > 0
          ? (
              (calculatedAvailableBalance / calculatedTotalBalance) *
              100
            ).toFixed(2)
          : 0,
    };

    const responseData = {
      ...platformWallet.toObject(),
      statistics,
    };

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin ví platform thành công',
      data: responseData,
    });
  } catch (error) {
    console.error('ERROR getPlatformWallet:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy thống kê payment
exports.getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalPayments,
      completedPayments,
      totalRevenue,
      platformRevenue,
      totalCommissions,
      pendingWithdrawals,
    ] = await Promise.all([
      Payment.countDocuments({ ...dateFilter }),
      Payment.countDocuments({ ...dateFilter, status: 'COMPLETED' }),
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Commission.aggregate([
        { $match: { ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$platformAmount' } } },
      ]),
      Commission.countDocuments({ ...dateFilter }),
      WithdrawalRequest.aggregate([
        { $match: { status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thống kê payment thành công',
      data: {
        totalPayments,
        completedPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        platformRevenue: platformRevenue[0]?.total || 0,
        totalCommissions,
        pendingWithdrawals: pendingWithdrawals[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('ERROR getPaymentStats:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy danh sách khóa học đã mua
exports.getMyPurchasedDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch enrollments with populated document, author, and interests
    const enrollments = await Enrollment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'documentId',
        match: { price: { $gt: 0 } }, // Only include documents with price > 0
        populate: [
          {
            path: 'author',
            select: 'name email avatar',
          },
          {
            path: 'interests',
            select: 'name emoji',
          },
        ],
      })
      .populate('userId', 'name email avatar')
      .lean();

    // Filter out enrollments where documentId is null (due to price filter)
    const validEnrollments = enrollments.filter(
      (enrollment) => enrollment.documentId
    );

    // Count total enrollments with non-free documents
    const total = await Enrollment.countDocuments({
      userId,
      documentId: {
        $in: await Document.find({ price: { $gt: 0 } }).distinct('_id'),
      },
    });

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách khóa học đã mua thành công',
      data: {
        documents: validEnrollments.map((enrollment) => ({
          ...enrollment.documentId,
          purchaseDate: enrollment.createdAt, // Include purchase date
        })),
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        total,
      },
    });
  } catch (error) {
    console.error('ERROR getMyPurchasedDocuments:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Kiểm tra payment có thể refund được không
exports.checkRefundEligibility = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy thanh toán',
        data: null,
      });
    }

    // Kiểm tra quyền của customer
    if (payment.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền kiểm tra thanh toán này',
        data: null,
      });
    }

    const Refund = require('../models/Refund');
    const { canRefund, reason } = await Refund.canCreateRefund(paymentId);

    // Thêm thông tin về thời gian còn lại
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hoursRemaining = canRefund
      ? Math.max(
          0,
          Math.ceil(
            (payment.createdAt.getTime() +
              24 * 60 * 60 * 1000 -
              new Date(Date.now())) /
              (60 * 60 * 1000)
          )
        )
      : 0;

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Kiểm tra tình trạng hoàn tiền thành công',
      data: {
        canRefund,
        reason: canRefund ? 'Có thể tạo yêu cầu hoàn tiền' : reason,
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status,
          createdAt: payment.createdAt,
        },
        hoursRemaining,
      },
    });
  } catch (error) {
    console.error('ERROR checkRefundEligibility:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy danh sách payments có thể refund
exports.getRefundablePayments = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tìm payments trong vòng 24h và status COMPLETED
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const payments = await Payment.find({
      userId,
      status: 'COMPLETED',
      createdAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ createdAt: -1 })
      .populate('documentId', 'title price imageUrls')
      .populate('sellerId', 'name email avatar');

    const Refund = require('../models/Refund');

    // Tìm tất cả refund requests đã bị REJECTED của user
    const rejectedRefunds = await Refund.find({
      customerId: userId,
      status: 'REJECTED',
    }).select('paymentId');

    const rejectedPaymentIds = new Set(
      rejectedRefunds.map((refund) => refund.paymentId.toString())
    );

    // Kiểm tra từng payment xem có thể refund không
    const refundablePayments = await Promise.all(
      payments.map(async (payment) => {
        // Nếu payment đã có refund request bị REJECTED thì không hiển thị
        if (rejectedPaymentIds.has(payment._id.toString())) {
          return null;
        }

        const { canRefund, reason } = await Refund.canCreateRefund(payment._id);
        const hoursRemaining = Math.max(
          0,
          Math.ceil(
            (payment.createdAt.getTime() +
              24 * 60 * 60 * 1000 -
              new Date(Date.now())) /
              (60 * 60 * 1000)
          )
        );

        return {
          ...payment.toObject(),
          canRefund,
          reason: canRefund ? 'Có thể tạo yêu cầu hoàn tiền' : reason,
          hoursRemaining,
        };
      })
    );

    // Lọc bỏ các payment bị loại trừ (null)
    const filteredPayments = refundablePayments.filter(
      (payment) => payment !== null
    );

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách thanh toán có thể hoàn tiền thành công',
      data: filteredPayments,
    });
  } catch (error) {
    console.error('ERROR getRefundablePayments:', error);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};
