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
  enrollFreeDocument,
  getDocsEnrolled,
} = require('../controllers/document.controller');
const { uploadFields } = require('../middlewares/upload.middleware');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protectRoute, getAllDocuments);
router.post('/', protectRoute, uploadFields, createDocument);
router.get('/my-documents', protectRoute, getMyDocuments);
router.get('/approved', protectRoute, getApprovedDocuments);
router.get('/rejected', protectRoute, getRejectedDocuments);
router.get('/not-enrolled', protectRoute, getRecommendedDocuments);
router.get('/enrolled', protectRoute, getDocsEnrolled);

router.get('/:id', protectRoute, getDocumentById);
router.get('/:id/feedback', protectRoute, getFeedbackByDocumentId);
router.get('/:id/author', protectRoute, getDocumentByAuthorId);
router.get('/:id/download', protectRoute, downloadDocument);
router.get('/:id/interest', protectRoute, getDocumentByInterestId);
router.put('/:id', protectRoute, uploadFields, updateDocument);
router.put('/:id/approve', protectRoute, approveDocument);
router.put('/:id/reject', protectRoute, rejectDocument);
router.post('/:id/feedback', protectRoute, sendFeedback);
router.post('/:id/enroll-free-document', protectRoute, enrollFreeDocument);
router.delete('/:id', protectRoute, deleteDocument);

module.exports = router;
