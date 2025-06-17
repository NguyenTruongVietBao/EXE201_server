const mongoose = require('mongoose');

// User A đã trả tiền cho Document B vào lúc ...
const paymentSchema = new mongoose.Schema(
  {
    userId: {
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
    paymentMethod: {
      type: String,
      enum: ['MOMO', 'ZALOPAY', 'BANK_TRANSFER'],
      default: 'BANK_TRANSFER',
    },
    amount: {
      type: Number,
      required: true,
    },
    transactionCode: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'AWAITING_CONFIRMATION',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
      ],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
