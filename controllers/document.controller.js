const {
  uploadMultipleFiles,
  uploadToCloudinary,
  getResourceType,
} = require('../configs/cloudinary');
const Document = require('../models/Document');
const Interest = require('../models/Interest');

exports.createDocument = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      discount = 0,
      isPublic = false,
      interests = [],
    } = req.body;

    const authorId = req.user._id;

    if (!title || !price || !authorId) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Thiếu thông tin bắt buộc: title, price, author',
        data: null,
      });
    }

    // Validate price
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Giá phải là số và không được âm',
        data: null,
      });
    }

    // Validate discount
    if (discount < 0 || discount > 100) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Discount phải từ 0 đến 100',
        data: null,
      });
    }

    // Validate interests nếu có
    let validInterests = [];
    if (interests && interests.length > 0) {
      try {
        const interestIds =
          typeof interests === 'string' ? JSON.parse(interests) : interests;
        const foundInterests = await Interest.find({
          _id: { $in: interestIds },
        });

        if (foundInterests.length !== interestIds.length) {
          return res.status(400).json({
            status: false,
            statusCode: 400,
            message: 'Một hoặc nhiều interest ID không tồn tại',
            data: null,
          });
        }
        validInterests = interestIds;
      } catch (parseError) {
        return res.status(400).json({
          status: false,
          statusCode: 400,
          message: 'Định dạng interests không hợp lệ',
          data: null,
        });
      }
    }

    // Upload files lên Cloudinary
    let imageUrls = [];
    let documentUrls = [];
    let videoUrls = [];

    // Upload images
    if (req.files && req.files.imageUrls) {
      imageUrls = await uploadMultipleFiles(
        req.files.imageUrls,
        'exe201/documents/images',
        'image'
      );
    }

    // Upload documents
    if (req.files && req.files.documentUrls) {
      documentUrls = await uploadMultipleFiles(
        req.files.documentUrls,
        'exe201/documents/files',
        'raw'
      );
    }

    // Upload videos
    if (req.files && req.files.videoUrls) {
      videoUrls = await uploadMultipleFiles(
        req.files.videoUrls,
        'exe201/documents/videos',
        'video'
      );
    }

    // Tạo document mới
    const newDocument = new Document({
      title: title.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      discount: parseFloat(discount),
      imageUrl: imageUrls,
      documentUrl: documentUrls,
      videoUrl: videoUrls,
      isPublic: isPublic,
      interests: validInterests,
      author: authorId,
    });

    const savedDocument = await newDocument.save();

    // Populate author và interest để trả về thông tin đầy đủ
    const populatedDocument = await Document.findById(savedDocument._id)
      .populate('author', 'name email')
      .populate('interests', 'name emoji');

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo tài liệu thành công',
      data: populatedDocument,
    });
  } catch (error) {
    console.log('ERROR creating document:', error);

    // Xử lý lỗi cụ thể
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Dữ liệu không hợp lệ',
        data: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.message.includes('Lỗi upload file')) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: error.message,
        data: null,
      });
    }

    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      discount,
      isPublic,
      interests = [],
      replaceFiles = false, // Flag để quyết định thay thế hay thêm file
    } = req.body;

    const authorId = req.user._id;

    // Tìm document hiện tại
    const existingDocument = await Document.findById(id);

    if (!existingDocument) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy tài liệu',
        data: null,
      });
    }

    // Kiểm tra quyền sở hữu
    if (existingDocument.author.toString() !== authorId.toString()) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền cập nhật tài liệu này',
        data: null,
      });
    }

    // Validate price nếu có
    if (price && (isNaN(price) || price < 0)) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Giá phải là số và không được âm',
        data: null,
      });
    }

    // Validate discount nếu có
    if (discount && (discount < 0 || discount > 100)) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Discount phải từ 0 đến 100',
        data: null,
      });
    }

    // Validate interests nếu có
    let validInterests = existingDocument.interests;
    if (interests && interests.length > 0) {
      try {
        const interestIds =
          typeof interests === 'string' ? JSON.parse(interests) : interests;
        const foundInterests = await Interest.find({
          _id: { $in: interestIds },
        });

        if (foundInterests.length !== interestIds.length) {
          return res.status(400).json({
            status: false,
            statusCode: 400,
            message: 'Một hoặc nhiều interest ID không tồn tại',
            data: null,
          });
        }
        validInterests = interestIds;
      } catch (parseError) {
        return res.status(400).json({
          status: false,
          statusCode: 400,
          message: 'Định dạng interests không hợp lệ',
          data: null,
        });
      }
    }

    // Xử lý upload file mới
    let newImageUrls = [];
    let newDocumentUrls = [];
    let newVideoUrls = [];

    // Upload images mới nếu có
    if (req.files && req.files.imageUrls) {
      newImageUrls = await uploadMultipleFiles(
        req.files.imageUrls,
        'exe201/documents/images',
        'image'
      );
    }

    // Upload documents mới nếu có
    if (req.files && req.files.documentUrls) {
      newDocumentUrls = await uploadMultipleFiles(
        req.files.documentUrls,
        'exe201/documents/files',
        'raw'
      );
    }

    // Upload videos mới nếu có
    if (req.files && req.files.videoUrls) {
      newVideoUrls = await uploadMultipleFiles(
        req.files.videoUrls,
        'exe201/documents/videos',
        'video'
      );
    }

    // Quyết định cách xử lý file URLs
    const shouldReplace = replaceFiles === 'true' || replaceFiles === true;

    const finalImageUrls = shouldReplace
      ? newImageUrls
      : [...existingDocument.imageUrl, ...newImageUrls];

    const finalDocumentUrls = shouldReplace
      ? newDocumentUrls
      : [...existingDocument.documentUrl, ...newDocumentUrls];

    const finalVideoUrls = shouldReplace
      ? newVideoUrls
      : [...existingDocument.videoUrl, ...newVideoUrls];

    // Tạo object update với chỉ các field được cung cấp
    const updateData = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (discount !== undefined) updateData.discount = parseFloat(discount);
    if (isPublic !== undefined)
      updateData.isPublic = isPublic === 'true' || isPublic === true;
    if (interests !== undefined) updateData.interests = validInterests;

    // Chỉ update file URLs nếu có file mới hoặc replaceFiles = true
    if (newImageUrls.length > 0 || shouldReplace) {
      updateData.imageUrl = finalImageUrls;
    }
    if (newDocumentUrls.length > 0 || shouldReplace) {
      updateData.documentUrl = finalDocumentUrls;
    }
    if (newVideoUrls.length > 0 || shouldReplace) {
      updateData.videoUrl = finalVideoUrls;
    }

    // Cập nhật document
    const updatedDocument = await Document.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('author', 'name email')
      .populate('interests', 'name emoji');

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật tài liệu thành công',
      data: updatedDocument,
    });
  } catch (error) {
    console.log('ERROR updating document:', error);

    // Xử lý lỗi cụ thể
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Dữ liệu không hợp lệ',
        data: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.message.includes('Lỗi upload file')) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: error.message,
        data: null,
      });
    }

    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getAllDocuments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      isPublic,
      author,
      interest,
      search,
    } = req.query;

    // Tạo filter object
    const filter = {};

    if (isPublic !== undefined) filter.isPublic = isPublic;
    if (author) filter.author = author;
    if (interest) filter.interests = { $in: [interest] };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(filter)
      .populate('author', 'name email')
      .populate('interests', 'name emoji')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(filter);

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: {
        documents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalDocuments: total,
          hasMore: parseInt(page) < Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.log('ERROR getting documents:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id)
      .populate('author', 'name email')
      .populate('interests', 'name emoji')
      .populate('feedback.user', 'name email');

    if (!document) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy tài liệu',
        data: null,
      });
    }

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy thông tin tài liệu thành công',
      data: document,
    });
  } catch (error) {
    console.log('ERROR getting document by id:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const authorId = req.user._id;

    // Tìm document hiện tại
    const existingDocument = await Document.findById(id);

    if (!existingDocument) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy tài liệu',
        data: null,
      });
    }

    // Kiểm tra quyền sở hữu
    if (existingDocument.author.toString() !== authorId.toString()) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền xóa tài liệu này',
        data: null,
      });
    }

    // Xóa document
    await Document.findByIdAndUpdate(id, { isDeleted: true });

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Xóa tài liệu thành công',
      data: null,
    });
  } catch (error) {
    console.log('ERROR deleting document:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getDocumentByInterestId = async (req, res) => {
  try {
    const { interestId } = req.params;
    const documents = await Document.find({ interests: interestId });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting document by interest:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getDocumentByAuthorId = async (req, res) => {
  try {
    const { authorId } = req.params;
    const documents = await Document.find({ author: authorId });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting document by author:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.publishDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findByIdAndUpdate(
      id,
      { isPublic: true },
      { new: true }
    );
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái tài liệu thành công',
      data: document,
    });
  } catch (error) {
    console.log('ERROR publishing document:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.unpublishDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findByIdAndUpdate(
      id,
      { isPublic: false },
      { new: true }
    );
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái tài liệu thành công',
      data: document,
    });
  } catch (error) {
    console.log('ERROR unpublishing document:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getPublishedDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ isPublic: true });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting published documents:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getUnpublishedDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ isPublic: false });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting unpublished documents:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.sendFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating } = req.body;
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy tài liệu',
        data: null,
      });
    }
    document.feedback.push({ user: req.user._id, comment, rating });
    await document.save();
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Gửi phản hồi thành công',
      data: document,
    });
  } catch (error) {
    console.log('ERROR sending feedback:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
