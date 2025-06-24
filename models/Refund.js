const mongoose = require('mongoose');

const RefundSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    bankDetails: {
      bankName: String,
      bankAccountName: String,
      bankAccountNumber: String,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    adminResponse: {
      type: String,
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
    refundCompletedAt: {
      type: Date,
    },
    isEligible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index cho performance
RefundSchema.index({ paymentId: 1 });
RefundSchema.index({ customerId: 1 });
RefundSchema.index({ status: 1 });
RefundSchema.index({ createdAt: -1 });

// Method để kiểm tra xem còn trong thời gian cho phép khiếu nại không
RefundSchema.methods.isWithinComplaintPeriod = function () {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.createdAt > twentyFourHoursAgo;
};

// Static method để kiểm tra payment có thể khiếu nại không
RefundSchema.statics.canCreateRefund = async function (paymentId) {
  const Payment = require('./Payment');
  const payment = await Payment.findById(paymentId);

  if (!payment || payment.status !== 'COMPLETED') {
    return {
      canRefund: false,
      reason: 'Payment không hợp lệ hoặc chưa hoàn thành',
    };
  }

  // Kiểm tra xem có trong vòng 24h không
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (payment.createdAt < twentyFourHoursAgo) {
    return { canRefund: false, reason: 'Đã quá thời hạn khiếu nại (24h)' };
  }

  // Kiểm tra xem đã có refund request chưa
  const existingRefund = await this.findOne({ paymentId });
  if (existingRefund) {
    return {
      canRefund: false,
      reason: 'Đã tồn tại yêu cầu hoàn tiền cho thanh toán này',
    };
  }

  return { canRefund: true };
};

module.exports = mongoose.model('Refund', RefundSchema);
