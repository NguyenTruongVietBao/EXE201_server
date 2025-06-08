const { v2: cloudinary } = require('cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Cấu hình multer để lưu file tạm thời
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // Giới hạn 25MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and GIF are allowed'));
    }
    cb(null, true);
  },
});

// Utility functions để upload file lên Cloudinary
const uploadToCloudinary = (
  fileBuffer,
  folder,
  resourceType = 'auto',
  originalName = ''
) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
    };

    if (resourceType === 'raw') {
      uploadOptions.format = originalName.split('.').pop();
    }

    cloudinary.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      })
      .end(fileBuffer);
  });
};

const uploadMultipleFiles = async (files, folder, resourceType = 'auto') => {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map((file) =>
    uploadToCloudinary(file.buffer, folder, resourceType, file.originalname)
  );
  try {
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    throw new Error(`Lỗi upload file: ${error.message}`);
  }
};

const getResourceType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
};

module.exports = {
  cloudinary,
  upload,
  uploadToCloudinary,
  uploadMultipleFiles,
  getResourceType,
};
