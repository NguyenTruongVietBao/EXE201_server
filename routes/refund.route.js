const express = require('express');
const router = express.Router();
const {
  createRefundRequest,
  getMyRefundRequests,
  getRefundDetails,
  getAllRefundRequests,
  processRefundRequest,
  getRefundStats,
  getSellerRefundRequests,
  getSellerRefundDetails,
  getSellerRefundStats,
} = require('../controllers/refund.controller');
const {
  protectRoute,
  authorizeRole,
} = require('../middlewares/auth.middleware');

// Customer routes
router.post('/', protectRoute, createRefundRequest); // Tạo yêu cầu hoàn tiền
router.get('/my-requests', protectRoute, getMyRefundRequests); // Lấy danh sách refund requests của customer

// Seller routes - ĐẶT CÁC ROUTE CỤ THỂ TRƯỚC
router.get('/seller/stats', protectRoute, getSellerRefundStats); // Thống kê refund của seller
router.get('/seller/requests/:id', protectRoute, getSellerRefundDetails); // Seller xem chi tiết refund request
router.get('/seller/requests', protectRoute, getSellerRefundRequests); // Lấy danh sách refund requests của seller

// Manager routes - ĐẶT CÁC ROUTE CỤ THỂ TRƯỚC
router.get('/stats/overview', protectRoute, getRefundStats); // Thống kê refund
router.put('/:id/process', protectRoute, processRefundRequest); // Xử lý refund request

// General routes - ĐẶT CÁC ROUTE GENERAL CUỐI CÙNG
router.get('/:id', protectRoute, getRefundDetails); // Lấy chi tiết refund request
router.get('/', protectRoute, getAllRefundRequests); // Lấy tất cả refund requests

module.exports = router;
