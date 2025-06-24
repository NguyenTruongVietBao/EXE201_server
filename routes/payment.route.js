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
  checkRefundEligibility,
  getRefundablePayments,
} = require('../controllers/payment.controller');

const router = express.Router();

// CUSTOMER - Callback từ PayOS sau khi thanh toán
router.post('/callback', handlePaymentCallback);
// CUSTOMER - Tài liệu đã mua
router.get('/my-purchased-documents', protectRoute, getMyPurchasedDocuments);
// CUSTOMER - Kiểm tra payment có thể refund không
router.get(
  '/check-refund-eligibility/:paymentId',
  protectRoute,
  checkRefundEligibility
);
// CUSTOMER - Lấy danh sách payments có thể refund
router.get('/refundable-payments', protectRoute, getRefundablePayments);

// SELLER - Lấy thông tin ví
router.get('/seller/seller-wallet', protectRoute, getSellerWallet);
// SELLER - Tạo yêu cầu rút tiền
router.post(
  '/seller/withdrawal-request',
  protectRoute,
  createWithdrawalRequest
);
// SELLER - Danh sách yêu cầu rút tiền của tôi
router.get(
  '/seller/withdrawal-requests',
  protectRoute,
  getMyWithdrawalRequests
);

// MANAGER - Lấy danh sách yêu cầu rút tiền
router.get(
  '/manager/withdrawal-requests',
  protectRoute,
  getAllWithdrawalRequests
);
// MANAGER - Xử lý yêu cầu rút tiền
router.put(
  '/manager/withdrawal-request/:id',
  protectRoute,
  processWithdrawalRequest
);
// CUSTOMER - Mua tài liệu
router.post('/buy-document/:id', protectRoute, buyDocument);
// MANAGER - Lấy thông tin ví platform
router.get('/manager/platform-wallet', protectRoute, getPlatformWallet);
// MANAGER - Lấy thống kê payment
router.get('/manager/stats', protectRoute, getPaymentStats);

module.exports = router;
