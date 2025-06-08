const express = require('express');
const {
  getAllInterests,
  createInterest,
  updateInterest,
} = require('../controllers/interest.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', protectRoute, createInterest);
router.get('/', getAllInterests);
router.put('/:id', protectRoute, updateInterest);

module.exports = router;
