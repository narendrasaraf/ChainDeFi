const express = require('express');
const router = express.Router();
const { registerUser, loginUser, walletLogin, updateUserRole, submitKYC, verifyKyc, checkLiveliness, getMe } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const { getTrustScoreHistory } = require('../controllers/trustScoreController');

// Traditional Auth Flow
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/wallet-login', walletLogin);

// Protected Routes
router.get('/me', protect, getMe);
router.put('/role', protect, updateUserRole);
router.post('/kyc', protect, submitKYC);
router.post('/verify-kyc', protect, verifyKyc);
router.post('/liveliness', protect, checkLiveliness);

// Analytics & Trust Score
router.get('/trust-score-history', protect, getTrustScoreHistory);

module.exports = router;

