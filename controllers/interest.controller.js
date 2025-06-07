const Interest = require('../models/Interest');
const { normalizeString } = require('../utils');

exports.getAllInterests = async (req, res) => {
  try {
    const interests = await Interest.find();
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Get all interests successfully',
      data: interests,
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
exports.createInterest = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Tên sở thích không được để trống',
        data: null,
      });
    }

    const normalizedName = normalizeString(name);

    // Tìm tất cả các interest có tên chuẩn hóa trùng nhau
    const existingInterests = await Interest.find({});
    const isDuplicate = existingInterests.some(
      (interest) => normalizeString(interest.name) === normalizedName
    );

    if (isDuplicate) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Sở thích này đã tồn tại',
        data: null,
      });
    }

    const interest = await Interest.create({ name });

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo sở thích thành công',
      data: interest,
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
