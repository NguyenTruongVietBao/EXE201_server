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
      default: new Date(Date.now()),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index để tìm conversation
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastActivity: -1 });

// Validation: chỉ có đúng 2 participants
conversationSchema.pre('save', function (next) {
  if (this.participants.length !== 2) {
    next(new Error('Conversation phải có đúng 2 participants'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Conversation', conversationSchema);
