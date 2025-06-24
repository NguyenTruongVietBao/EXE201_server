const express = require('express');
const {
  createGroup,
  sendJoinRequest,
  acceptJoinRequest,
  rejectJoinRequest,
  getAllGroups,
  getGroupDetails,
  getGroupJoinRequests,
  getJoinedGroups,
  getMyGroups,
  getAllJoinRequests,
  getUserGroupStats,
} = require('../controllers/group.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

// Tạo nhóm mới
router.post('/', protectRoute, createGroup);

// ĐẶT CÁC ROUTE CỤ THỂ TRƯỚC - QUAN TRỌNG!
// Lấy danh sách nhóm đã tham gia
router.get('/joined-groups', protectRoute, getJoinedGroups);

// Lấy danh sách nhóm mà tôi tạo
router.get('/my-groups', protectRoute, getMyGroups);

// Lấy tất cả join requests mà tôi đã gửi
router.get('/my-join-requests', protectRoute, getAllJoinRequests);

// Lấy thống kê nhóm của user
router.get('/my-stats', protectRoute, getUserGroupStats);

// Lấy danh sách tất cả nhóm (với ưu tiên theo interests)
router.get('/', protectRoute, getAllGroups);

// ĐẶT ROUTE DYNAMIC PARAMETER CUỐI CÙNG
// Lấy thông tin chi tiết nhóm
router.get('/:groupId', protectRoute, getGroupDetails);

// Gửi yêu cầu join nhóm
router.post('/:groupId/join', protectRoute, sendJoinRequest);

// Lấy danh sách yêu cầu join của nhóm (chỉ admin)
router.get('/:groupId/requests', protectRoute, getGroupJoinRequests);

// Chấp nhận yêu cầu join nhóm - chỉ admin
router.put('/requests/:requestId/accept', protectRoute, acceptJoinRequest);

// Từ chối yêu cầu join nhóm - chỉ admin (cần lý do)
router.put('/requests/:requestId/reject', protectRoute, rejectJoinRequest);

module.exports = router;
