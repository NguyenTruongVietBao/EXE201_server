const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    avatar: {
      type: String,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'SELLER', 'ADMIN', 'MANAGER'],
      default: 'CUSTOMER',
    },
    bankName: {
      type: String,
      default: '',
    },
    bankAccountName: {
      type: String,
      default: '',
    },
    bankAccountNumber: {
      type: String,
      default: '',
    },
    interests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interest',
      },
    ],
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// Cập nhật avatar mặc định
userSchema.pre('save', function (next) {
  if (!this.avatar && this.name) {
    this.avatar = `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(
      this.name
    )}&backgroundType=gradientLinear&backgroundColor=b6e3f4,d1d4f9`;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
