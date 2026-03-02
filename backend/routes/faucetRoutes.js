const express = require('express');
const router = express.Router();
const { claimFaucet } = require('../controllers/faucetController');
const { protect } = require('../middleware/authMiddleware');

// Route to claim testnet faucet
router.post('/claim', protect, claimFaucet);

module.exports = router;
