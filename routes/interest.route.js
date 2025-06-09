const express = require('express');
const {
  getAllInterests,
  createInterest,
  updateInterest,
  getRecommendedDocumentsAndUsers,
} = require('../controllers/interest.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', protectRoute, createInterest);
router.get('/', getAllInterests);
router.put('/:id', protectRoute, updateInterest);
router.get('/recommended', protectRoute, getRecommendedDocumentsAndUsers);

module.exports = router;
