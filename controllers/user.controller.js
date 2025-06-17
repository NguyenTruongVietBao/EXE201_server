const User = require('../models/User');
const Interest = require('../models/Interest');
const { generateToken } = require('../utils/auth');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate('interests', 'name emoji');
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get all users successfully',
      data: users,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
    });
  }
};
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).populate('interests', 'name emoji');
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'User not found',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get user by id successfully',
      data: user,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
    });
  }
};
exports.setUserInterests = async (req, res) => {
  const { id } = req.params;
  const { interests } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }

    if (!Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Vui lòng chọn ít nhất một sở thích',
        data: null,
      });
    }

    const validInterests = await Interest.find({
      _id: { $in: interests },
    });

    if (validInterests.length !== interests.length) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Một số sở thích không hợp lệ',
        data: null,
      });
    }

    const accessToken = generateToken(user._id, user.role, user.email);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { interests },
      { new: true }
    ).populate('interests', 'name emoji');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật sở thích thành công',
      data: {
        user: updatedUser,
        accessToken,
      },
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.updateProfile = async (req, res) => {
  const { id } = req.params;
  const { name, avatar, phone } = req.body;

  try {
    // Kiểm tra user có tồn tại không
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }

    // Chuẩn bị object update với validation
    const updateData = {};

    if (name !== undefined && name !== null) {
      const trimmedName = name.toString().trim();
      if (trimmedName.length === 0) {
        return res.status(400).json({
          status: false,
          statusCode: 400,
          message: 'Tên không được để trống',
          data: null,
        });
      }
      updateData.name = trimmedName;
    }

    if (avatar !== undefined && avatar !== null) {
      const trimmedAvatar = avatar.toString().trim();
      updateData.avatar = trimmedAvatar;
    }

    if (phone !== undefined && phone !== null) {
      const trimmedPhone = phone.toString().trim();
      if (trimmedPhone.length > 0) {
        // Validation cơ bản cho số điện thoại
        const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
        if (!phoneRegex.test(trimmedPhone)) {
          return res.status(400).json({
            status: false,
            statusCode: 400,
            message: 'Số điện thoại không hợp lệ',
            data: null,
          });
        }
        updateData.phone = trimmedPhone;
      }
    }

    // Kiểm tra có dữ liệu để update không
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Không có dữ liệu để cập nhật',
        data: null,
      });
    }

    // Cập nhật user và populate interests
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('interests', 'name emoji');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật thông tin người dùng thành công',
      data: updatedUser,
    });
  } catch (error) {
    console.log('ERROR updateProfile:', error);

    // Xử lý validation errors từ mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: messages.join(', '),
        data: null,
      });
    }

    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.banUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isBanned: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái người dùng thành công',
      data: user,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.unbanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isBanned: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái người dùng thành công',
      data: user,
    });
  } catch (error) {
    console.log('ERROR', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('interests', 'name emoji')
      .populate('documents', 'title interests')
      .populate('groups', 'name');

    if (!user) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin người dùng thành công',
      data: user,
    });
  } catch (error) {
    console.log('ERROR get profile:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server',
      data: null,
    });
  }
};
