const Refund = require('../models/Refund');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const SellerWallet = require('../models/SellerWallet');
const PlatformWallet = require('../models/PlatformWallet');
const Enrollment = require('../models/Enrollment');

// Customer tạo yêu cầu hoàn tiền
exports.createRefundRequest = async (req, res) => {
  try {
    const { paymentId, reason, bankDetails } = req.body;
    const customerId = req.user._id;

    // Validate input
    if (!paymentId || !reason || !bankDetails) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'paymentId, reason và bankDetails là bắt buộc',
        data: null,
      });
    }

    if (reason.trim().length < 10) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Lý do tối thiểu 10 ký tự',
        data: null,
      });
    }

    // Validate bankDetails
    if (
      !bankDetails.bankName ||
      !bankDetails.bankAccountName ||
      !bankDetails.bankAccountNumber
    ) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message:
          'Thông tin ngân hàng không đầy đủ (bankName, bankAccountName, bankAccountNumber)',
        data: null,
      });
    }

    // Kiểm tra xem có thể tạo refund không
    const { canRefund, reason: errorReason } = await Refund.canCreateRefund(
      paymentId
    );
    if (!canRefund) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: errorReason,
        data: null,
      });
    }

    // Lấy thông tin payment
    const payment = await Payment.findById(paymentId)
      .populate('documentId', 'title')
      .populate('sellerId', 'name email');

    // Kiểm tra quyền của customer
    if (payment.userId.toString() !== customerId.toString()) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền tạo khiếu nại cho thanh toán này',
        data: null,
      });
    }

    // Tạo refund request - CHỈ TẠO RECORD, CHƯA TRỪ TIỀN GÌ
    // Tiền sẽ chỉ bị trừ khi manager APPROVED request này
    const refund = await Refund.create({
      paymentId: payment._id,
      customerId,
      documentId: payment.documentId._id,
      sellerId: payment.sellerId._id,
      reason: reason.trim(),
      amount: payment.amount,
      bankDetails: {
        bankName: bankDetails.bankName.trim(),
        bankAccountName: bankDetails.bankAccountName.trim(),
        bankAccountNumber: bankDetails.bankAccountNumber.trim(),
      },
    });

    console.log(
      `📝 Created refund request ${refund._id} for payment ${payment._id} - amount: ${payment.amount} VND`
    );

    // Populate để trả về thông tin đầy đủ
    const populatedRefund = await Refund.findById(refund._id)
      .populate('customerId', 'name email avatar')
      .populate('documentId', 'title price')
      .populate('sellerId', 'name email avatar')
      .populate('paymentId');

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo yêu cầu hoàn tiền thành công',
      data: populatedRefund,
    });
  } catch (error) {
    console.error('ERROR createRefundRequest:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy danh sách refund requests của customer
exports.getMyRefundRequests = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { status } = req.query;

    const query = { customerId };
    if (status) {
      query.status = status;
    }

    const refunds = await Refund.find(query)
      .sort({ createdAt: -1 })
      .populate('documentId', 'title price imageUrls')
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu hoàn tiền thành công',
      data: refunds,
    });
  } catch (error) {
    console.error('ERROR getMyRefundRequests:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Lấy chi tiết refund request
exports.getRefundDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const refund = await Refund.findById(id)
      .populate('customerId', 'name email avatar')
      .populate('documentId', 'title price imageUrls description')
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email avatar')
      .populate('paymentId');

    if (!refund) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy yêu cầu hoàn tiền',
        data: null,
      });
    }

    // Kiểm tra quyền xem: customer hoặc admin
    const isCustomer = refund.customerId._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xem yêu cầu hoàn tiền này',
        data: null,
      });
    }

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy chi tiết yêu cầu hoàn tiền thành công',
      data: refund,
    });
  } catch (error) {
    console.error('ERROR getRefundDetails:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Admin lấy tất cả refund requests
exports.getAllRefundRequests = async (req, res) => {
  try {
    const { status, sortOrder = 'desc' } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const sortOptions = { createdAt: sortOrder === 'asc' ? 1 : -1 };

    const refunds = await Refund.find(query)
      .sort(sortOptions)
      .populate('customerId', 'name email avatar')
      .populate('documentId', 'title price')
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email');

    // Thống kê thêm
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Refund.countDocuments({ status: 'PENDING' }),
      Refund.countDocuments({ status: 'APPROVED' }),
      Refund.countDocuments({ status: 'REJECTED' }),
    ]);

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu hoàn tiền thành công',
      data: {
        refunds,
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: pendingCount + approvedCount + rejectedCount,
        },
      },
    });
  } catch (error) {
    console.error('ERROR getAllRefundRequests:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Admin xử lý refund request
exports.processRefundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;
    const adminId = req.user._id;

    // Validate input
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message:
          'Trạng thái không hợp lệ. Chỉ chấp nhận APPROVED hoặc REJECTED',
        data: null,
      });
    }

    if (!adminResponse || adminResponse.trim().length < 10) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Phản hồi của admin là bắt buộc và tối thiểu 10 ký tự',
        data: null,
      });
    }

    // Tìm refund request
    const refund = await Refund.findById(id)
      .populate('paymentId')
      .populate('customerId', 'name email')
      .populate('documentId', 'title')
      .populate('sellerId', 'name email');

    if (!refund) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy yêu cầu hoàn tiền',
        data: null,
      });
    }

    if (refund.status !== 'PENDING') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Yêu cầu hoàn tiền đã được xử lý',
        data: null,
      });
    }

    // Cập nhật refund request
    refund.status = status;
    refund.adminResponse = adminResponse.trim();
    refund.processedBy = adminId;
    refund.processedAt = new Date(Date.now());

    if (status === 'APPROVED') {
      // CHỈ KHI APPROVED mới thực sự trừ tiền từ wallet và xử lý hoàn tiền
      console.log(`✅ Manager approved refund request ${refund._id}`);
      await processRefund(refund);
      refund.refundCompletedAt = new Date(Date.now());
    } else if (status === 'REJECTED') {
      // Nếu REJECTED, chỉ cập nhật status, không trừ tiền gì
      console.log(`❌ Manager rejected refund request ${refund._id}`);
    }

    await refund.save();

    // Populate để trả về thông tin đầy đủ
    const updatedRefund = await Refund.findById(refund._id)
      .populate('customerId', 'name email avatar')
      .populate('documentId', 'title price')
      .populate('sellerId', 'name email avatar')
      .populate('processedBy', 'name email avatar')
      .populate('paymentId');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: `Yêu cầu hoàn tiền đã được ${
        status === 'APPROVED' ? 'chấp nhận' : 'từ chối'
      }`,
      data: updatedRefund,
    });
  } catch (error) {
    console.error('ERROR processRefundRequest:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Helper function để xử lý hoàn tiền
async function processRefund(refund) {
  try {
    console.log(
      `🔄 Processing APPROVED refund for payment ${refund.paymentId._id}...`
    );

    // 1. Tìm commission tương ứng
    const commission = await Commission.findOne({
      paymentId: refund.paymentId._id,
      status: 'PENDING',
    });

    if (commission) {
      // 2. Commission chưa được release - trừ từ pendingBalance
      console.log(
        `💰 Commission still PENDING - deducting from pending balances`
      );

      commission.status = 'REFUNDED';
      await commission.save();

      // 3. Trừ tiền từ pending balance của seller
      const sellerWallet = await SellerWallet.findOne({
        sellerId: refund.sellerId,
      });
      if (
        sellerWallet &&
        sellerWallet.pendingBalance >= commission.sellerAmount
      ) {
        sellerWallet.pendingBalance -= commission.sellerAmount;
        sellerWallet.totalEarned -= commission.sellerAmount;
        await sellerWallet.save();
        console.log(
          `💸 Deducted ${commission.sellerAmount} VND from seller pending balance`
        );
      }

      // 4. Trừ tiền từ pending balance của platform
      const platformWallet = await PlatformWallet.findOne();
      if (
        platformWallet &&
        platformWallet.pendingBalance >= commission.platformAmount
      ) {
        platformWallet.pendingBalance -= commission.platformAmount;
        platformWallet.totalBalance -= commission.platformAmount;
        platformWallet.totalCommissionEarned -= commission.platformAmount;
        await platformWallet.save();
        console.log(
          `💸 Deducted ${commission.platformAmount} VND from platform pending balance`
        );
      }
    } else {
      // 5. Commission đã được release - trừ từ availableBalance
      const releasedCommission = await Commission.findOne({
        paymentId: refund.paymentId._id,
        status: 'RELEASED',
      });

      if (releasedCommission) {
        console.log(
          `💰 Commission already RELEASED - deducting from available balances`
        );

        releasedCommission.status = 'REFUNDED';
        await releasedCommission.save();

        // 6. Trừ từ available balance của seller
        const sellerWallet = await SellerWallet.findOne({
          sellerId: refund.sellerId,
        });
        if (
          sellerWallet &&
          sellerWallet.availableBalance >= releasedCommission.sellerAmount
        ) {
          sellerWallet.availableBalance -= releasedCommission.sellerAmount;
          sellerWallet.totalEarned -= releasedCommission.sellerAmount;
          await sellerWallet.save();
          console.log(
            `💸 Deducted ${releasedCommission.sellerAmount} VND from seller available balance`
          );
        }

        // 7. Trừ từ available balance của platform
        const platformWallet = await PlatformWallet.findOne();
        if (
          platformWallet &&
          platformWallet.availableBalance >= releasedCommission.platformAmount
        ) {
          platformWallet.availableBalance -= releasedCommission.platformAmount;
          platformWallet.totalBalance -= releasedCommission.platformAmount;
          await platformWallet.save();
          console.log(
            `💸 Deducted ${releasedCommission.platformAmount} VND from platform available balance`
          );
        }
      }
    }

    // 8. Xóa enrollment của customer (customer mất quyền truy cập tài liệu)
    const deletedEnrollment = await Enrollment.findOneAndDelete({
      userId: refund.customerId,
      documentId: refund.documentId,
    });

    if (deletedEnrollment) {
      console.log(`🗑️ Removed enrollment for customer ${refund.customerId}`);
    }

    // 9. Cập nhật payment status thành REFUNDED
    await Payment.findByIdAndUpdate(refund.paymentId._id, {
      status: 'REFUNDED',
    });

    console.log(
      `✅ Refund completed for payment ${refund.paymentId._id}, amount: ${refund.amount} VND`
    );
  } catch (error) {
    console.error('❌ ERROR processing refund:', error);
    throw error;
  }
}

// Lấy thống kê refund
exports.getRefundStats = async (req, res) => {
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
      totalRefunds,
      pendingRefunds,
      approvedRefunds,
      rejectedRefunds,
      totalRefundAmount,
      approvedRefundAmount,
    ] = await Promise.all([
      Refund.countDocuments(dateFilter),
      Refund.countDocuments({ ...dateFilter, status: 'PENDING' }),
      Refund.countDocuments({ ...dateFilter, status: 'APPROVED' }),
      Refund.countDocuments({ ...dateFilter, status: 'REJECTED' }),
      Refund.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Refund.aggregate([
        { $match: { ...dateFilter, status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thống kê refund thành công',
      data: {
        totalRefunds,
        pendingRefunds,
        approvedRefunds,
        rejectedRefunds,
        totalRefundAmount: totalRefundAmount[0]?.total || 0,
        approvedRefundAmount: approvedRefundAmount[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('ERROR getRefundStats:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

exports.getSellerRefundRequests = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { status, sortOrder = 'desc' } = req.query;

    const query = { sellerId };
    if (status) {
      query.status = status;
    }

    const sortOptions = { createdAt: sortOrder === 'asc' ? 1 : -1 };

    const [refunds, total] = await Promise.all([
      Refund.find(query)
        .sort(sortOptions)
        .populate('customerId', 'name email avatar')
        .populate('documentId', 'title price imageUrls')
        .populate('processedBy', 'name email')
        .populate('paymentId', 'createdAt transactionCode'),
      Refund.countDocuments(query),
    ]);

    // Thống kê cho seller
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Refund.countDocuments({ sellerId, status: 'PENDING' }),
      Refund.countDocuments({ sellerId, status: 'APPROVED' }),
      Refund.countDocuments({ sellerId, status: 'REJECTED' }),
    ]);

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách yêu cầu hoàn tiền của seller thành công',
      data: {
        refunds,
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: pendingCount + approvedCount + rejectedCount,
        },
      },
    });
  } catch (error) {
    console.error('ERROR getSellerRefundRequests:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Seller xem chi tiết refund request của document mình
exports.getSellerRefundDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user._id;

    const refund = await Refund.findById(id)
      .populate('customerId', 'name email avatar')
      .populate('documentId', 'title price imageUrls description')
      .populate('processedBy', 'name email avatar')
      .populate('paymentId', 'createdAt transactionCode amount');

    if (!refund) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy yêu cầu hoàn tiền',
        data: null,
      });
    }

    // Kiểm tra quyền: chỉ seller của document mới được xem
    if (refund.sellerId.toString() !== sellerId.toString()) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xem yêu cầu hoàn tiền này',
        data: null,
      });
    }

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy chi tiết yêu cầu hoàn tiền thành công',
      data: refund,
    });
  } catch (error) {
    console.error('ERROR getSellerRefundDetails:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

// Seller lấy thống kê refund của mình
exports.getSellerRefundStats = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { startDate, endDate } = req.query;

    const dateFilter = { sellerId };
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const [
      totalRefunds,
      pendingRefunds,
      approvedRefunds,
      rejectedRefunds,
      totalRefundAmount,
      approvedRefundAmount,
    ] = await Promise.all([
      Refund.countDocuments(dateFilter),
      Refund.countDocuments({ ...dateFilter, status: 'PENDING' }),
      Refund.countDocuments({ ...dateFilter, status: 'APPROVED' }),
      Refund.countDocuments({ ...dateFilter, status: 'REJECTED' }),
      Refund.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Refund.aggregate([
        { $match: { ...dateFilter, status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    // Tính tỷ lệ
    const approvalRate =
      totalRefunds > 0
        ? ((approvedRefunds / totalRefunds) * 100).toFixed(2)
        : 0;
    const rejectionRate =
      totalRefunds > 0
        ? ((rejectedRefunds / totalRefunds) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thống kê refund của seller thành công',
      data: {
        totalRefunds,
        pendingRefunds,
        approvedRefunds,
        rejectedRefunds,
        totalRefundAmount: totalRefundAmount[0]?.total || 0,
        approvedRefundAmount: approvedRefundAmount[0]?.total || 0,
        approvalRate: parseFloat(approvalRate),
        rejectionRate: parseFloat(rejectionRate),
      },
    });
  } catch (error) {
    console.error('ERROR getSellerRefundStats:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi hệ thống',
      data: null,
    });
  }
};

module.exports = {
  createRefundRequest: exports.createRefundRequest,
  getMyRefundRequests: exports.getMyRefundRequests,
  getRefundDetails: exports.getRefundDetails,
  getAllRefundRequests: exports.getAllRefundRequests,
  processRefundRequest: exports.processRefundRequest,
  getRefundStats: exports.getRefundStats,
  getSellerRefundRequests: exports.getSellerRefundRequests,
  getSellerRefundDetails: exports.getSellerRefundDetails,
  getSellerRefundStats: exports.getSellerRefundStats,
};
