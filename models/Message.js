const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Chat trong nhóm
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    // Chat 1-1 giữa 2 users
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    messageType: {
      type: String,
      enum: ['text', 'image'],
      required: true,
    },
    content: {
      type: String,
      trim: true, // Dùng cho tin nhắn text hoặc caption cho ảnh
    },
    fileUrl: {
      type: String, // Dùng cho URL của ảnh
    },
  },
  { timestamps: true }
);

messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

messageSchema.pre('save', function (next) {
  // 1. Phải có groupId HOẶC receiverId
  if (!this.groupId && !this.receiverId) {
    return next(new Error('Message phải thuộc về group hoặc có receiver.'));
  }
  // 2. Không được có cả hai
  if (this.groupId && this.receiverId) {
    return next(
      new Error('Message không thể vừa là group chat vừa là direct message.')
    );
  }
  // 3. Nếu là text, phải có content
  if (this.messageType === 'text' && !this.content) {
    return next(new Error('Text message phải có content.'));
  }
  // 4. Nếu là image, phải có fileUrl
  if (this.messageType === 'image' && !this.fileUrl) {
    return next(new Error('Image message phải có fileUrl.'));
  }

  next();
});

module.exports = mongoose.model('Message', messageSchema);
