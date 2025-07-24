const {
  generateToken,
  hashPassword,
  generateVerifyEmailToken,
  sendEmail,
  comparePassword,
} = require('../utils/auth');
const Interest = require('../models/Interest');
const User = require('../models/User');

exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Người dùng đã tồn tại',
        data: null,
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Mật khẩu phải có ít nhất 6 ký tự',
        data: null,
      });
    }
    if (!phone || phone.length !== 10) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Số điện thoại là bắt buộc',
        data: null,
      });
    }
    const hashedPassword = await hashPassword(password);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
    });

    user.password = await hashPassword(password);
    user.verificationToken = generateVerifyEmailToken();
    user.verificationTokenExpire = new Date(Date.now() + 3600000); // 1 hour
    const accessToken = generateToken(user._id, user.role, user.email);

    const verificationUrl = `${
      process.env.FRONTEND_URL
    }/auth/verify-email/${encodeURIComponent(user.email)}`;

    await sendEmail({
      to: user.email,
      subject: 'Xác thực Email',
      text: `
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
            <h2 style="color:rgb(179, 93, 44); margin-bottom: 20px;">Prilab</h2>
            <h1 style="color: #2d3748; margin-bottom: 20px;">Xác thực Email của bạn</h1>
            <p style="font-size: 16px; margin-bottom: 25px;">Xin chào ${name},</p>
            <p style="font-size: 16px; margin-bottom: 25px;">Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhấp vào nút bên dưới để xác thực địa chỉ email của bạn:</p>
            <a href="${verificationUrl}" target="_blank" style="background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-bottom: 25px;">Xác thực Email</a>
            <p style="font-size: 14px; color: #718096; margin-bottom: 15px;">Hoặc bạn có thể sử dụng mã xác thực này:</p>
            <div style="background-color: #edf2f7; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
              <code style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${user.verificationToken}</code>
            </div>
            <p style="font-size: 14px; color: #718096;">Mã xác thực này sẽ hết hạn sau 1 giờ.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            <p style="font-size: 12px; color: #718096;">Nếu bạn không yêu cầu email này, vui lòng bỏ qua nó.</p>
          </div>
        </body>       
      `,
    });

    await user.save();

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Đăng ký thành công',
      data: {
        user,
        accessToken,
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi máy chủ',
      data: null,
    });
  }
};
exports.registerSeller = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      bankName,
      bankAccountName,
      bankAccountNumber,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Người dùng đã tồn tại',
        data: null,
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Mật khẩu phải có ít nhất 6 ký tự',
        data: null,
      });
    }
    if (!phone || phone.length !== 10) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Số điện thoại là bắt buộc',
        data: null,
      });
    }
    if (!bankName || !bankAccountName || !bankAccountNumber) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Tên ngân hàng, tên tài khoản và số tài khoản là bắt buộc',
        data: null,
      });
    }
    const hashedPassword = await hashPassword(password);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'SELLER',
      phone,
      bankName,
      bankAccountName,
      bankAccountNumber,
    });

    user.password = await hashPassword(password);
    user.verificationToken = generateVerifyEmailToken();
    user.verificationTokenExpire = new Date(Date.now() + 3600000); // 1 hour
    const accessToken = generateToken(user._id, user.role, user.email);

    const verificationUrl = `${
      process.env.FRONTEND_URL
    }/auth/verify-email/${encodeURIComponent(user.email)}`;

    await sendEmail({
      to: user.email,
      subject: 'Xác thực Email',
      text: `
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
            <h2 style="color:rgb(179, 93, 44); margin-bottom: 20px;">Prilab</h2>
            <h1 style="color: #2d3748; margin-bottom: 20px;">Xác thực Email của bạn</h1>
            <p style="font-size: 16px; margin-bottom: 25px;">Xin chào ${name},</p>
            <p style="font-size: 16px; margin-bottom: 25px;">Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhấp vào nút bên dưới để xác thực địa chỉ email của bạn:</p>
            <a href="${verificationUrl}" target="_blank" style="background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-bottom: 25px;">Xác thực Email</a>
            <p style="font-size: 14px; color: #718096; margin-bottom: 15px;">Hoặc bạn có thể sử dụng mã xác thực này:</p>
            <div style="background-color: #edf2f7; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
              <code style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${user.verificationToken}</code>
            </div>
            <p style="font-size: 14px; color: #718096;">Mã xác thực này sẽ hết hạn sau 1 giờ.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            <p style="font-size: 12px; color: #718096;">Nếu bạn không yêu cầu email này, vui lòng bỏ qua nó.</p>
          </div>
        </body>       
      `,
    });

    await user.save();

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Đăng ký thành công',
      data: {
        user,
        accessToken,
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi máy chủ',
      data: null,
    });
  }
};
exports.verifyEmail = async (req, res) => {
  try {
    const { email, verificationToken } = req.body;

    if (!verificationToken) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Vui lòng cung cấp mã xác thực',
        data: null,
      });
    }

    const user = await User.findOne({
      email,
      verificationToken,
      verificationTokenExpire: { $gt: new Date(Date.now()) },
    });

    if (!user) {
      return res.status(401).json({
        status: false,
        statusCode: 401,
        message: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
        data: null,
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    const accessToken = generateToken(user._id, user.role, user.email);

    await user.save();

    if (user.role === 'SELLER') {
      res.status(200).json({
        status: true,
        statusCode: 200,
        message: 'Xác thực email thành công',
        data: {
          user,
          accessToken,
        },
      });
    }

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Xác thực email thành công',
      data: {
        user,
        accessToken,
        needSetInterests: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi khi xác thực email',
      data: null,
    });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Email và mật khẩu là bắt buộc',
        data: null,
      });
    }

    const user = await User.findOne({ email })
      .populate('interests', 'name emoji')
      .populate('documents', 'title price discount')
      .populate('groups', 'name');
    if (!user) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Email không hợp lệ',
        data: null,
      });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Mật khẩu không hợp lệ',
        data: null,
      });
    }
    if (user.role === 'CUSTOMER' && user.interests.length === 0) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Vui lòng cài đặt sở thích trước khi đăng nhập',
        data: null,
      });
    }
    if (!user.isVerified) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Vui lòng xác thực email trước khi đăng nhập',
        data: null,
      });
    }
    if (user.isBanned) {
      return res.status(401).json({
        status: false,
        statusCode: 401,
        message: 'Tài khoản của bạn đã bị khóa',
        data: null,
      });
    }

    const accessToken = generateToken(user._id, user.role, user.email);

    await user.save();

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Login successful',
      data: {
        user,
        accessToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Login failed. Please try again later.',
      data: null,
    });
  }
};
