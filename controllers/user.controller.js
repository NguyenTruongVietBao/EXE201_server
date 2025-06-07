const { User } = require('../models/User');
const Interest = require('../models/Interest');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
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
    const user = await User.findById(id);
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

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { interests },
      { new: true }
    ).populate('interests', 'name emoji');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật sở thích thành công',
      data: updatedUser,
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
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }
    if (name && name.trim().length > 0) {
      existingUser.name = name;
    }
    if (avatar && avatar.trim().length > 0) {
      existingUser.avatar = avatar;
    }
    if (phone && phone.trim().length > 0) {
      existingUser.phone = phone;
    }
    if (name) {
      existingUser.name = name;
    }
    if (avatar) {
      existingUser.avatar = avatar;
    }
    if (phone) {
      existingUser.phone = phone;
    }
    const user = await existingUser.save();

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật người dùng thành công',
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
