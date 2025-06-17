const express = require('express');
const { protectRoute } = require('../middlewares/auth.middleware');
const {
  buyDocument,
  handlePaymentCallback,
  createWithdrawalRequest,
  getMyWithdrawalRequests,
  getSellerWallet,
  getAllWithdrawalRequests,
  processWithdrawalRequest,
  getPlatformWallet,
  getPaymentStats,
  getMyPurchasedDocuments,
  checkDocumentAccess,
} = require('../controllers/payment.controller');

const router = express.Router();

// Mua khóa học
router.post('/buy-document/:id', protectRoute, buyDocument);

// Callback từ PayOS sau khi thanh toán
router.get('/callback', handlePaymentCallback);

// API cho user
router.get('/my-purchases', protectRoute, getMyPurchasedDocuments);
router.get('/check-access/:documentId', protectRoute, checkDocumentAccess);

// API cho seller
router.get('/seller/seller-wallet', protectRoute, getSellerWallet);
router.post(
  '/seller/withdrawal-request',
  protectRoute,
  createWithdrawalRequest
);
router.get(
  '/seller/withdrawal-requests',
  protectRoute,
  getMyWithdrawalRequests
);

// API cho admin
router.get(
  '/admin/withdrawal-requests',
  protectRoute,
  getAllWithdrawalRequests
);
router.put(
  '/admin/withdrawal-request/:id',
  protectRoute,
  processWithdrawalRequest
); // TODO
router.get('/admin/platform-wallet', protectRoute, getPlatformWallet);
router.get('/admin/stats', protectRoute, getPaymentStats);

module.exports = router;
