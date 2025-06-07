const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: 3,
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
      default: `https://api.dicebear.com/9.x/initials/svg?seed=default`,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'SELLER', 'ADMIN', 'MANAGER'],
      default: 'CUSTOMER',
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^[0-9]{10}$/, 'Please add a valid phone number'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
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
  },
  { timestamps: true }
);

const sellerSchema = new mongoose.Schema({
  billingInfo: {
    type: String,
  },
  bankName: {
    type: String,
  },
  bankAccountName: {
    type: String,
  },
  bankAccountNumber: {
    type: String,
  },
});

const User = mongoose.model('User', userSchema);
const Seller = User.discriminator('Seller', sellerSchema);

module.exports = { User, Seller };
