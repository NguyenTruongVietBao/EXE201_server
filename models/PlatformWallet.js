const mongoose = require('mongoose');

const platformWalletSchema = new mongoose.Schema(
  {
    // Tổng số tiền trong ví
    totalBalance: {
      type: Number,
      default: 0,
    },
    // Số tiền có thể rút
    availableBalance: {
      type: Number,
      default: 0,
    },
    // Số tiền đang chờ xử lý
    pendingBalance: {
      type: Number,
      default: 0,
    },
    // Tổng số tiền đã kiếm được
    totalCommissionEarned: {
      type: Number,
      default: 0,
    },
    // Tổng số tiền đã hoàn trả
    totalRefunded: {
      type: Number,
      default: 0,
    },
    // Tổng số tiền đã chuyển cho seller
    totalWithdrawals: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformWallet', platformWalletSchema);
