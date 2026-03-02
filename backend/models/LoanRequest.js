const mongoose = require('mongoose');

const loanRequestSchema = new mongoose.Schema({
    borrower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amountRequested: {
        type: Number,
        required: true,
        min: 1,
    },
    interestRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    durationMonths: {
        type: Number,
        required: true,
        min: 1,
    },
    purpose: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Funded', 'Active', 'Repaid', 'Defaulted'],
        default: 'Pending',
    },
    lender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null, // Null until a lender accepts the request
    },
    simulatedSmartContractId: {
        type: String,
        default: null, // Populated when the loan moves to Funded/Active
    },
    fundingTxHash: {
        type: String,
        default: null,
    },
    repaymentTxHash: {
        type: String,
        default: null,
    },
    insuranceActivated: {
        type: Boolean,
        default: false,
    },
    loanMode: {
        type: Number,   // 0 = ETH, 1 = ERC20/tUSDT
        default: 1,
    },
    firstInstallmentRewarded: {
        type: Boolean,
        default: false, // Prevents duplicate +50 first-installment bonus per loan
    },
    onChainProcessed: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

module.exports = mongoose.model('LoanRequest', loanRequestSchema);
