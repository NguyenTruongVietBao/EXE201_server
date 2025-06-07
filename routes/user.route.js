const express = require('express');
const {
  getAllUsers,
  getUserById,
  setUserInterests,
  updateProfile,
} = require('../controllers/user.controller');

const router = express.Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id/set-interests', setUserInterests);
router.put('/:id/update-profile', updateProfile);

module.exports = router;
