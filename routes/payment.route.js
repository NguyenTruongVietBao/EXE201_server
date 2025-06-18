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
router.post('/callback', handlePaymentCallback);

// Tài liệu đã mua
router.get('/my-purchased-documents', protectRoute, getMyPurchasedDocuments);

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

// MANAGER - Lấy danh sách yêu cầu rút tiền
router.get(
  '/manager/withdrawal-requests',
  protectRoute,
  authorizeRole('MANAGER'),
  getAllWithdrawalRequests
);
// MANAGER - Xử lý yêu cầu rút tiền
router.put(
  '/manager/withdrawal-request/:id',
  protectRoute,
  authorizeRole('MANAGER'),
  processWithdrawalRequest
);
// MANAGER - Lấy thông tin ví platform
router.get(
  '/manager/platform-wallet',
  protectRoute,
  authorizeRole('MANAGER'),
  getPlatformWallet
);
// MANAGER - Lấy thống kê payment
router.get(
  '/manager/stats',
  protectRoute,
  authorizeRole('MANAGER'),
  getPaymentStats
);

module.exports = router;
