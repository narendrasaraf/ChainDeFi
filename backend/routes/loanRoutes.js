const express = require('express');
const router = express.Router();
const {
    createLoanRequest,
    getPendingLoans,
    fundLoan,
    getUserLoans,
    repayLoan,
    getBorrowerAds,
    getLenderUpcomingPayments,
    postLenderAd,
    getLenderAds,
    deleteLenderAd,
    registerAgreement
} = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');

// Loan Request & Funding Flow
router.post('/', protect, createLoanRequest);
router.get('/', getPendingLoans);
router.get('/my', protect, getUserLoans);
router.get('/my-ads', protect, getBorrowerAds);
router.get('/lender/upcoming-payments', protect, getLenderUpcomingPayments);
router.put('/:id/fund', protect, fundLoan);
router.put('/:id/repay', protect, repayLoan);

// Lender Ad Off-chain Matching Flow
router.post('/lender/ad', protect, postLenderAd);
router.get('/lender/my-ads', protect, getLenderAds);
router.delete('/lender/ad/:id', protect, deleteLenderAd);

// Register deployed agreement address for auto-repay
router.post('/register-agreement', protect, registerAgreement);

module.exports = router;
