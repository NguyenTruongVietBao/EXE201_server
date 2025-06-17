const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index để tìm conversation giữa 2 users
conversationSchema.index({ participants: 1 });

// Validation: chỉ có đúng 2 participants
conversationSchema.pre('save', function (next) {
  if (this.participants.length !== 2) {
    next(new Error('Conversation phải có đúng 2 participants'));
  } else {
    next();
  }
});

// Static method để tìm conversation giữa 2 users
conversationSchema.statics.findBetweenUsers = function (userId1, userId2) {
  return this.findOne({
    participants: { $all: [userId1, userId2] },
  });
};

module.exports = mongoose.model('Conversation', conversationSchema);
