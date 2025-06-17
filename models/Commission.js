const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    platformFee: { type: Number, required: true },
    sellerAmount: { type: Number, required: true },
    platformAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'RELEASED', 'CANCELLED'],
      default: 'PENDING',
    },
    releaseDate: {
      type: Date,
      default: Date.now() + 24 * 60 * 60 * 1000, // 1d later
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Commission', commissionSchema);
