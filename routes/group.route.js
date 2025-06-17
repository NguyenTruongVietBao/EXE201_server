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
  getUserGroupStats,
} = require('../controllers/group.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

// Tạo nhóm mới
router.post('/', protectRoute, createGroup);

// Lấy danh sách tất cả nhóm (với ưu tiên theo interests)
router.get('/', protectRoute, getAllGroups);

// Lấy danh sách nhóm đã tham gia
router.get('/joined-groups', protectRoute, getJoinedGroups);

// Lấy thống kê nhóm của user
router.get('/my-stats', protectRoute, getUserGroupStats);

// Chấp nhận yêu cầu join nhóm - chỉ admin
router.put('/requests/:requestId/accept', protectRoute, acceptJoinRequest);

// Từ chối yêu cầu join nhóm - chỉ admin (cần lý do)
router.put('/requests/:requestId/reject', protectRoute, rejectJoinRequest);

// Lấy thông tin chi tiết nhóm
router.get('/:groupId', protectRoute, getGroupDetails);

// Gửi yêu cầu join nhóm
router.post('/:groupId/join', protectRoute, sendJoinRequest);

// Lấy danh sách yêu cầu join của nhóm (chỉ admin)
router.get('/:groupId/requests', protectRoute, getGroupJoinRequests);

module.exports = router;
