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
    console.log('🚀 ~ exports.buyDocument= ~ paymentData:', paymentData);
    const paymentLink = await createPayment(
      paymentData,
      req.user._id,
      finalPrice
    );

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
      // releaseDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h later
      releaseDate: Date.now() + 60 * 1000, // 1m later
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

// Lấy danh sách yêu cầu rút tiền của seller
exports.getMyWithdrawalRequests = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { sellerId };
    if (status) {
      query.status = status;
    }

    const withdrawalRequests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('processedBy', 'name email avatar');

    const total = await WithdrawalRequest.countDocuments(query);

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu rút tiền thành công',
      data: {
        withdrawalRequests,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
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
    const now = Date.now();
    const commissionsToRelease = await Commission.find({
      status: 'PENDING',
      releaseDate: { $lte: now },
    });
    for (const commission of commissionsToRelease) {
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

    console.log(`Released ${commissionsToRelease.length} commissions`);
  } catch (error) {
    console.error('ERROR releaseCommissions:', error);
  }
};

// Lấy danh sách yêu cầu rút tiền
exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const withdrawalRequests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email avatar');

    const total = await WithdrawalRequest.countDocuments(query);

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu rút tiền thành công',
      data: {
        withdrawalRequests,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
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

// Lấy thông tin platform wallet
exports.getPlatformWallet = async (req, res) => {
  try {
    let platformWallet = await PlatformWallet.findOne();
    if (!platformWallet) {
      platformWallet = new PlatformWallet({
        totalBalance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        totalCommissionEarned: 0,
        totalRefunded: 0,
      });
      await platformWallet.save();
    }

    return res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin ví platform thành công',
      data: platformWallet,
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
        $gte: new Date(startDate).toLocaleString(),
        $lte: new Date(endDate).toLocaleString(),
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
