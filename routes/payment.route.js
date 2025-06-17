const express = require('express');
const {
  protectRoute,
  authorizeRole,
} = require('../middlewares/auth.middleware');
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
} = require('../controllers/payment.controller');

const router = express.Router();

// Mua khóa học
router.post('/buy-document/:id', protectRoute, buyDocument);

// Callback từ PayOS sau khi thanh toán
router.get('/callback', handlePaymentCallback);

// API cho user
router.get('/my-purchases', protectRoute, getMyPurchasedDocuments);

// SELLER - Lấy thông tin ví
router.get(
  '/seller/seller-wallet',
  protectRoute,
  authorizeRole('SELLER'),
  getSellerWallet
);
// SELLER - Tạo yêu cầu rút tiền
router.post(
  '/seller/withdrawal-request',
  protectRoute,
  authorizeRole('SELLER'),
  createWithdrawalRequest
);
// SELLER - Danh sách yêu cầu rút tiền của tôi
router.get(
  '/seller/withdrawal-requests',
  protectRoute,
  authorizeRole('SELLER'),
  getMyWithdrawalRequests
);

// ADMIN - Lấy danh sách yêu cầu rút tiền
router.get(
  '/admin/withdrawal-requests',
  protectRoute,
  authorizeRole('ADMIN'),
  getAllWithdrawalRequests
);
// ADMIN - Xử lý yêu cầu rút tiền
router.put(
  '/admin/withdrawal-request/:id',
  protectRoute,
  authorizeRole('ADMIN'),
  processWithdrawalRequest
);
// ADMIN - Lấy thông tin ví platform
router.get(
  '/admin/platform-wallet',
  protectRoute,
  authorizeRole('ADMIN'),
  getPlatformWallet
);
// ADMIN - Lấy thống kê payment
router.get(
  '/admin/stats',
  protectRoute,
  authorizeRole('ADMIN'),
  getPaymentStats
);

module.exports = router;
