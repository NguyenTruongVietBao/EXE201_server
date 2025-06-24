const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    messageType: {
      type: String,
      enum: ['text', 'image'],
      required: true,
    },
    content: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index để tối ưu query
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

// Validation đơn giản
messageSchema.pre('save', function (next) {
  if (
    (!this.conversationId && !this.groupId) ||
    (this.conversationId && this.groupId)
  ) {
    return next(new Error('Message phải thuộc về conversation hoặc group'));
  }

  if (this.messageType === 'text' && !this.content) {
    return next(new Error('Text message phải có content'));
  }

  if (this.messageType === 'image' && !this.fileUrl) {
    return next(new Error('Image message phải có fileUrl'));
  }

  next();
});

module.exports = mongoose.model('Message', messageSchema);
