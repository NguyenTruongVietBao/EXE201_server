const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protectRoute } = require('../middlewares/auth.middleware');
const {
  getConversations,
  createConversation,
  getConversationMessages,
  getGroupMessages,
  uploadChatImage,
  sendMessage,
  sendGroupMessage,
} = require('../controllers/chat.controller');

// Cấu hình multer cho upload ảnh
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Send image
router.post(
  '/upload-image',
  protectRoute,
  upload.single('image'),
  uploadChatImage
);
// USER - USER
router.get('/conversations', protectRoute, getConversations);
router.post('/conversations', protectRoute, createConversation);
router.get(
  '/conversations/:conversationId/messages',
  protectRoute,
  getConversationMessages
);
router.post(
  '/conversations/:conversationId/messages',
  protectRoute,
  sendMessage
);
// USER - GROUP
router.get('/groups/:groupId/messages', protectRoute, getGroupMessages);
router.post('/groups/:groupId/messages', protectRoute, sendGroupMessage);

module.exports = router;
