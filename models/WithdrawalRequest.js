const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
      default: 'PENDING',
    },
    bankDetails: {
      bankName: String,
      bankAccountName: String,
      bankAccountNumber: String,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
