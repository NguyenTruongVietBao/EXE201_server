const express = require('express');
const {
  createDocument,
  getAllDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentByInterestId,
  getMyDocuments,
  approveDocument,
  rejectDocument,
  getApprovedDocuments,
  getRejectedDocuments,
  sendFeedback,
  getFeedbackByDocumentId,
  getDocumentByAuthorId,
  downloadDocument,
  getRecommendedDocuments,
} = require('../controllers/document.controller');
const { uploadFields } = require('../middlewares/upload.middleware');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protectRoute, getAllDocuments);
router.get('/my-documents', protectRoute, getMyDocuments);
router.get('/approved', protectRoute, getApprovedDocuments);
router.get('/rejected', protectRoute, getRejectedDocuments);
router.post('/', protectRoute, uploadFields, createDocument);
router.get('/recommended', protectRoute, getRecommendedDocuments);

router.put('/:id', protectRoute, uploadFields, updateDocument);
router.get('/:id', protectRoute, getDocumentById);
router.delete('/:id', protectRoute, deleteDocument);
router.get('/interest/:interestId', protectRoute, getDocumentByInterestId);
router.put('/approve/:id', protectRoute, approveDocument);
router.put('/reject/:id', protectRoute, rejectDocument);
router.post('/:id/feedback', protectRoute, sendFeedback);
router.get('/:id/feedback', protectRoute, getFeedbackByDocumentId);
router.get('/author/:id', protectRoute, getDocumentByAuthorId);
router.get('/:id/download', protectRoute, downloadDocument);

module.exports = router;
