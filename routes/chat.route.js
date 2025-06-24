const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protectRoute } = require('../middlewares/auth.middleware');
const multer = require('multer');
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
  chatController.uploadChatImage
);

// Chat 1-1
router.get('/conversations', protectRoute, chatController.getConversations);
router.post(
  '/conversations/:participantId',
  protectRoute,
  chatController.createConversation
);
router.get(
  '/conversations/:conversationId/messages',
  protectRoute,
  chatController.getConversationMessages
);
router.post(
  '/conversations/:conversationId/messages',
  protectRoute,
  chatController.sendMessage
);

// Chat nhóm
router.get('/groups', protectRoute, chatController.getJoinedGroups);
router.get(
  '/groups/:groupId/messages',
  protectRoute,
  chatController.getGroupMessages
);
router.post(
  '/groups/:groupId/messages',
  protectRoute,
  chatController.sendGroupMessage
);

module.exports = router;
