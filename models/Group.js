const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maxMembers: {
      type: Number,
      default: 100,
      min: 2,
      max: 1000,
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        joinDate: {
          type: Date,
          default: new Date(Date.now()),
        },
        isAdmin: {
          type: Boolean,
          default: false,
        },
      },
    ],
    interests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interest',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
