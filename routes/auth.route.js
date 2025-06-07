const express = require('express');

const router = express.Router();

const {
  registerCustomer,
  registerSeller,
  verifyEmail,
  login,
} = require('../controllers/auth.controller');

router.post('/register-customer', registerCustomer);
router.post('/register-seller', registerSeller);
router.post('/verify-email', verifyEmail);
router.post('/login', login);

module.exports = router;
