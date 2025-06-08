const express = require('express');
const {
  createDocument,
  getAllDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentByInterestId,
  getDocumentByAuthorId,
  publishDocument,
  unpublishDocument,
  getPublishedDocuments,
  getUnpublishedDocuments,
  sendFeedback,
} = require('../controllers/document.controller');
const { uploadFields } = require('../middlewares/upload.middleware');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protectRoute, getAllDocuments);
router.get('/published', protectRoute, getPublishedDocuments);
router.get('/unpublished', protectRoute, getUnpublishedDocuments);
router.get('/:id', protectRoute, getDocumentById);
router.post('/', protectRoute, uploadFields, createDocument);
router.put('/:id', protectRoute, uploadFields, updateDocument);
router.delete('/:id', protectRoute, deleteDocument);
router.get('/interest/:interestId', protectRoute, getDocumentByInterestId);
router.get('/author/:authorId', protectRoute, getDocumentByAuthorId);
router.put('/publish/:id', protectRoute, publishDocument);
router.put('/unpublish/:id', protectRoute, unpublishDocument);
router.post('/:id/feedback', protectRoute, sendFeedback);

module.exports = router;
