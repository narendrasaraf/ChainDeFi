const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    walletAddress: {
        type: String,
        sparse: true,
        index: true,
    },
    role: {
        type: String,
        enum: ['Borrower', 'Lender', 'Unassigned'],
        default: 'Unassigned',
    },
    kycStatus: {
        type: String,
        enum: ['Pending', 'FaceVerified', 'Verified', 'Rejected'],
        default: 'Pending',
    },
    kycDetails: {
        documentType: { type: String, enum: ['Aadhaar', 'PAN'] },
        documentNumber: { type: String },
        verifiedAt: { type: Date }
    },
    nftIssued: {
        type: Boolean,
        default: false,
    },
    nftTxHash: {
        type: String,
    },
    trustScore: {
        type: Number,
        default: 300,
        min: 300,
        max: 900
    },
    completedLoans: {
        type: Number,
        default: 0
    },
    hasReceivedFirstInstallmentBonus: {
        type: Boolean,
        default: false
    },
    hasReceivedFirstFullRepaymentBonus: {
        type: Boolean,
        default: false
    },
    trustHistory: [{
        action: String,
        points: Number,
        newScore: Number,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    hasClaimedFaucet: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
