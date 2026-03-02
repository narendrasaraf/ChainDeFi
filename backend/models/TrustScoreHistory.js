const mongoose = require('mongoose');

const trustScoreHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    changeAmount: {
        type: Number,
        required: true,
    },
    previousScore: {
        type: Number,
        default: 0,
    },
    newScore: {
        type: Number,
        required: true,
    },
    reason: {
        type: String,
        enum: [
            // Legacy values
            'On-time Repayment', 'Early Repayment', 'Late Repayment',
            'Defaulted', 'Successful Funding', 'Manual Adjustment',
            // Active values used by the app
            'NFT Minted',
            'Funded a Loan',
            'Successful Repayment',
        ],
        required: true,
    },
    associatedLoan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LoanRequest', // Can be null if it's a manual adjustment
        default: null,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    }
}, { timestamps: true });

module.exports = mongoose.model('TrustScoreHistory', trustScoreHistorySchema);
