const { uploadMultipleFiles } = require('../configs/cloudinary');
const Enrollment = require('../models/Enrollment');
const Document = require('../models/Document');
const Interest = require('../models/Interest');
const User = require('../models/User');
const { downloadDocumentAsZip } = require('../utils/cloudinaryDownloader');
const fs = require('fs');

exports.createDocument = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      duration,
      discount = 0,
      isPublic = false,
      interests = [],
      isFree,
    } = req.body;

    const authorId = req.user._id;

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
      duration: duration,
      imageUrls: imageUrls,
      documentUrls: documentUrls,
      videoUrls: videoUrls,
      isPublic: isPublic,
      isFree: isFree,
      interests: validInterests,
      author: authorId,
    });

    const savedDocument = await newDocument.save();

    // Populate author và interest để trả về thông tin đầy đủ
    const populatedDocument = await Document.findById(savedDocument._id)
      .populate('author', 'name email avatar documents')
      .populate('interests', 'name emoji');

    const author = await User.findById(authorId);
    author.documents.push(savedDocument._id);
    await author.save();

    res.status(201).json({
      status: true,
      statusCode: 201,
      message: 'Tạo tài liệu thành công',
      data: populatedDocument,
    });
  } catch (error) {
    console.log('ERROR creating document:', error);

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
      : [...existingDocument.imageUrls, ...newImageUrls];

    const finalDocumentUrls = shouldReplace
      ? newDocumentUrls
      : [...existingDocument.documentUrls, ...newDocumentUrls];

    const finalVideoUrls = shouldReplace
      ? newVideoUrls
      : [...existingDocument.videoUrls, ...newVideoUrls];

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
      updateData.imageUrls = finalImageUrls;
    }
    if (newDocumentUrls.length > 0 || shouldReplace) {
      updateData.documentUrls = finalDocumentUrls;
    }
    if (newVideoUrls.length > 0 || shouldReplace) {
      updateData.videoUrls = finalVideoUrls;
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
}; // TODO
exports.getAllDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Document.countDocuments();
    const documents = await Document.find()
      .populate('author', 'name email avatar documents')
      .populate('interests', 'name emoji')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
      .populate('author', 'name email avatar documents')
      .populate('interests', 'name emoji')
      .populate('feedback.user', 'name email avatar');

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
    const { id } = req.params;
    const documents = await Document.find({ interests: id })
      .populate('author', 'name email avatar documents')
      .populate('interests', 'name emoji')
      .populate('feedback.user', 'name email avatar');
    if (!documents) {
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
exports.getMyDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const documents = await Document.find({ author: userId })
      .populate({
        path: 'interests',
        select: 'name emoji',
      })
      .populate({
        path: 'author',
        select: 'name email avatar',
      });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Tôi có ' + documents.length + ' tài liệu',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting my documents:', error);
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
    const { id } = req.params;
    const user = await User.findById(id).populate('interests', 'name emoji');
    const documents = await Document.find({ author: id }).populate(
      'interests',
      'name emoji'
    );
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: {
        author: user,
        documents,
      },
    });
  } catch (error) {
    console.log('ERROR getting document by author id:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.approveDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findByIdAndUpdate(
      id,
      { status: 'APPROVED' },
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
exports.rejectDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findByIdAndUpdate(
      id,
      { status: 'REJECTED' },
      { new: true }
    );
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Cập nhật trạng thái tài liệu thành công',
      data: document,
    });
  } catch (error) {
    console.log('ERROR rejecting document:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getApprovedDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ status: 'APPROVED' });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting approved documents:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.getRejectedDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ status: 'REJECTED' });
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách tài liệu thành công',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting rejected documents:', error);
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
exports.getFeedbackByDocumentId = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id).populate(
      'feedback.user',
      'name email avatar'
    );
    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy phản hồi thành công',
      data: document.feedback,
    });
  } catch (error) {
    console.log('ERROR getting feedback by document id:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.enrollFreeDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy tài liệu',
        data: null,
      });
    }
    const hasEnrollment = await Enrollment.findOne({
      documentId: id,
      userId: req.user._id,
    });
    if (hasEnrollment) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Bạn đã đăng ký khóa học này',
        data: null,
      });
    }
    if (document.isFree) {
      const enrollment = await Enrollment.create({
        documentId: id,
        userId: req.user._id,
      });
      res.status(200).json({
        status: true,
        statusCode: 200,
        message: 'Đăng ký khóa học thành công',
        data: enrollment,
      });
    } else {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        message: 'Mua khóa học để tải tài liệu',
        data: null,
      });
    }
  } catch (error) {
    console.log('ERROR enrolling document:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
exports.downloadDocument = async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const userId = req.user?._id;

    // Check if document exists
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        message: 'Không tìm thấy tài liệu',
        data: null,
      });
    }

    // ✅ FIX: Kiểm tra quyền truy cập đầy đủ như trong downloadDocumentAsZip
    const enrollment = await Enrollment.findOne({
      documentId: documentId,
      userId: userId,
    });

    const isAuthor = document.author.toString() === userId.toString();
    const isFree = document.isFree || document.price === 0;

    // Kiểm tra quyền truy cập: phải có enrollment HOẶC là tác giả HOẶC tài liệu miễn phí
    if (!enrollment && !isAuthor && !isFree) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        message: 'Bạn không có quyền truy cập tài liệu này',
        data: null,
      });
    }

    // Gọi function download
    const result = await downloadDocumentAsZip(documentId, userId);

    // ✅ FIX: Kiểm tra đúng property 'success'
    if (!result.success) {
      return res.status(500).json({
        status: false,
        statusCode: 500,
        message: 'Lỗi khi tạo file ZIP',
        data: null,
      });
    }

    // ✅ FIX: Kiểm tra file tồn tại trước khi stream
    if (!fs.existsSync(result.zipPath)) {
      return res.status(500).json({
        status: false,
        statusCode: 500,
        message: 'Không thể tạo file ZIP',
        data: null,
      });
    }

    // Set headers cho file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prilab_document_${documentId}.zip"`
    );

    // Stream file ZIP về client
    const fileStream = fs.createReadStream(result.zipPath);

    // ✅ FIX: Xử lý lỗi khi stream file
    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          status: false,
          statusCode: 500,
          message: 'Lỗi khi tải file',
          data: null,
        });
      }
    });

    fileStream.pipe(res);

    // Xóa file ZIP sau khi gửi (5 giây)
    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(result.zipPath)) {
          fs.unlinkSync(result.zipPath);
          console.log(`🗑️ Deleted ZIP file: ${result.zipPath}`);
        }
      }, 5000);
    });

    console.log(`📦 ZIP download started for document: ${documentId}`);
  } catch (error) {
    console.error('Download error:', error);

    // ✅ FIX: Xử lý lỗi chi tiết hơn
    let statusCode = 500;
    let message = 'Lỗi server khi tải tài liệu';

    if (
      error.message.includes('không có quyền') ||
      error.message.includes('quyền truy cập')
    ) {
      statusCode = 403;
      message = error.message;
    } else if (error.message.includes('không tìm thấy')) {
      statusCode = 404;
      message = error.message;
    }

    res.status(statusCode).json({
      status: false,
      statusCode: statusCode,
      message: message,
      data: null,
    });
  }
};
exports.getRecommendedDocuments = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 12, isFree } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy interests của user hiện tại
    const currentUser = await User.findById(currentUserId).select('interests');
    const userInterestIds = currentUser?.interests || [];

    // Lấy danh sách document IDs mà user đã enroll
    const enrolledDocuments = await Enrollment.find({
      userId: currentUserId,
    }).select('documentId');
    const enrolledDocumentIds = enrolledDocuments.map(
      (enrollment) => enrollment.documentId
    );

    // Build match conditions
    const matchConditions = {
      status: 'APPROVED',
      author: { $ne: currentUserId }, // Không lấy document của chính mình
      _id: { $nin: enrolledDocumentIds }, // Loại bỏ những document đã enroll
      isDeleted: { $ne: true }, // Loại bỏ những document đã xóa
    };

    // Add isFree filter if specified
    if (isFree !== undefined) {
      matchConditions.isFree = isFree === 'true';
    }

    // Aggregate pipeline để tính toán và sắp xếp theo interests chung
    const documents = await Document.aggregate([
      {
        $match: matchConditions,
      },
      {
        $addFields: {
          // Tìm interests chung giữa document và user
          sharedInterests: {
            $setIntersection: ['$interests', userInterestIds],
          },
        },
      },
      {
        $addFields: {
          // Tính số interests chung
          sharedInterestsCount: {
            $size: '$sharedInterests',
          },
          // Tính tỷ lệ phần trăm phù hợp
          matchPercentage: {
            $cond: {
              if: { $gt: [{ $literal: userInterestIds.length }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $size: '$sharedInterests' },
                      { $literal: userInterestIds.length },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $sort: {
          sharedInterestsCount: -1, // Ưu tiên theo interests chung (giảm dần)
          createdAt: -1, // Sau đó theo thời gian tạo
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { name: 1, avatar: 1, email: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interests',
          pipeline: [{ $project: { name: 1, emoji: 1 } }],
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ['$author', 0] },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          price: 1,
          discount: 1,
          isFree: 1,
          imageUrls: 1,
          author: 1,
          interests: 1,
          sharedInterestsCount: 1,
          matchPercentage: { $round: ['$matchPercentage', 1] },
          createdAt: 1,
        },
      },
    ]);

    // Count total documents
    const totalDocumentsCount = await Document.aggregate([
      { $match: matchConditions },
      {
        $addFields: {
          sharedInterests: {
            $setIntersection: ['$interests', userInterestIds],
          },
        },
      },
      {
        $count: 'total',
      },
    ]);
    const totalDocuments = totalDocumentsCount[0]?.total || 0;
    const totalPages = Math.ceil(totalDocuments / parseInt(limit));

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Lấy danh sách khóa học gợi ý thành công',
      data: {
        documents,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDocuments,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.log('ERROR getting recommended documents:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy danh sách khóa học gợi ý',
      data: null,
    });
  }
};
exports.getDocsEnrolled = async (req, res) => {
  try {
    // Fetch enrollments with populated document details, author, and interests
    const enrollments = await Enrollment.find({
      userId: req.user._id,
    })
      .populate({
        path: 'documentId',
        select:
          '_id title description price discount duration download imageUrls documentUrls videoUrls interests author status isFree feedback createdAt updatedAt',
        populate: [
          {
            path: 'author',
            select: 'name email avatar',
          },
          {
            path: 'interests',
            select: 'name emoji',
          },
        ],
      })
      .lean();

    // Map enrollments to documents, including enrollmentDate
    const documents = enrollments
      .filter((enrollment) => enrollment.documentId) // Remove enrollments with missing documents
      .map((enrollment) => ({
        ...enrollment.documentId,
        enrollmentDate: enrollment.enrollmentDate,
      }));

    res.status(200).json({
      status: true,
      statusCode: 200,
      message: 'Đã lấy được ' + documents.length + ' documents',
      data: documents,
    });
  } catch (error) {
    console.log('ERROR getting docs enrolled:', error);
    res.status(500).json({
      status: false,
      statusCode: 500,
      message: 'Lỗi server nội bộ',
      data: null,
    });
  }
};
