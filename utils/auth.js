const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const accessTokenSecretKey = process.env.ACCESS_TOKEN_SECRET_KEY;

exports.generateToken = (userId, userRole, userEmail) => {
  return jwt.sign({ userId, userRole, userEmail }, accessTokenSecretKey, {
    expiresIn: '30d',
  });
};

exports.verifyToken = (token) => {
  return jwt.verify(token, accessTokenSecretKey);
};

exports.decodeToken = (token) => {
  return jwt.decode(token, accessTokenSecretKey);
};

exports.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

exports.comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

exports.generateVerifyEmailToken = () => {
  return crypto.randomInt(100000, 999999).toString();
};

exports.generateResetPasswordToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.text,
  };

  await transporter.sendMail(mailOptions);
};
