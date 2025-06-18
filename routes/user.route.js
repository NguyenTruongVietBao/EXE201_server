const express = require('express');
const {
  getAllUsers,
  getUserById,
  setUserInterests,
  updateProfile,
  banUser,
  unbanUser,
  getCustomerProfile,
  getProfile,
  getSellerStatistics,
  getManagerStatistics,
} = require('../controllers/user.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getAllUsers);
router.get('/profile', protectRoute, getProfile);
router.get('/seller-statistics', protectRoute, getSellerStatistics);
router.get('/manager-statistics', protectRoute, getManagerStatistics);

router.get('/:id', getUserById);
router.put('/:id/set-interests', setUserInterests);
router.put('/:id/update-profile', updateProfile);
router.put('/:id/ban', banUser);
router.put('/:id/unban', unbanUser);

module.exports = router;
