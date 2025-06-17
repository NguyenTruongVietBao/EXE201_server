const multer = require('multer');

const storage = multer.memoryStorage();

const allowedTypes = {
  // Images
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true,
  // Documents
  'application/pdf': true,
  'application/msword': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.ms-excel': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'application/vnd.ms-powerpoint': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
  'text/plain': true,
  // Videos
  'video/mp4': true,
  'video/mpeg': true,
  'video/quicktime': true,
  'video/x-msvideo': true,
  'video/webm': true,
};

const documentUpload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes[file.mimetype]) {
      return cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// Middleware upload với các field names cụ thể
const uploadFields = documentUpload.fields([
  { name: 'imageUrls', maxCount: 50 },
  { name: 'documentUrls', maxCount: 10 },
  { name: 'videoUrls', maxCount: 5 },
]);

module.exports = { uploadFields, documentUpload };
