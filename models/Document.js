const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    duration: {
      type: String,
      default: '1 day',
    },
    download: {
      type: Number,
      default: 0,
    },
    imageUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    documentUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    videoUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    feedback: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        comment: { type: String, trim: true },
        rating: { type: Number, min: 1, max: 5 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    interests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interest',
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['REJECTED', 'PENDING', 'APPROVED'],
      default: 'PENDING',
    },
    isFree: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
