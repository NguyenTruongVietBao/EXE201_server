const mongoose = require('mongoose');

const joinGroupRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    message: {
      type: String,
      default: 'Cho mình vào nhóm với nhé!',
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Đảm bảo một user chỉ có thể gửi một yêu cầu cho một nhóm
joinGroupRequestSchema.index({ userId: 1, groupId: 1 }, { unique: true });

module.exports = mongoose.model('JoinGroupRequest', joinGroupRequestSchema);
