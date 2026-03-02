const mongoose = require('mongoose');

const lenderAdSchema = new mongoose.Schema({
    lenderAddress: {
        type: String,
        required: true,
        index: true
    },
    amountAvailable: {
        type: Number,
        required: true,
        min: 1
    },
    minInterestRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    maxDuration: {
        type: Number,
        required: true,
        min: 1
    },
    loanMode: {
        type: Number,   // 0 = ETH, 1 = ERC20/tUSDT
        required: true,
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

module.exports = mongoose.model('LenderAd', lenderAdSchema);
