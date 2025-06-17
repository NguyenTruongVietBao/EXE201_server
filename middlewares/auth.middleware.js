const User = require('../models/User');
const { verifyToken } = require('../utils/auth');

const protectRoute = async (req, res, next) => {
  try {
    const accessToken = req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return res.status(401).json({
        status: false,
        statusCode: 401,
        message: 'Không có token, truy cập bị từ chối',
        data: null,
      });
    }

    const decoded = verifyToken(accessToken);
    if (!decoded) {
      return res.status(401).json({
        status: false,
        statusCode: 401,
        message: 'Token không hợp lệ',
        data: null,
      });
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    req.user = user;
    next();
  } catch (error) {
    console.log('ERROR protectRoute:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền truy cập đường dẫn này',
        data: null,
      });
    }
    next();
  };
};

module.exports = { protectRoute, authorizeRole };
