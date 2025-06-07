const express = require('express');
const {
  getAllInterests,
  createInterest,
} = require('../controllers/interest.controller');

const router = express.Router();

router.post('/', createInterest);
router.get('/', getAllInterests);

module.exports = router;
