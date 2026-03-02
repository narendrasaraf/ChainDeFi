'use strict';
/**
 * trustScoreService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Off-chain CIBIL-style scoring engine.
 *
 * Score range: 300 – 900
 * All updates are journaled into user.trustHistory and logged as structured JSON.
 *
 * Public API:
 *   increaseScore(userId, points, reason)  → Promise<Number>  new score
 *   decreaseScore(userId, points, reason)  → Promise<Number>  new score
 */

const User = require('../models/User');

const MIN_SCORE = 300;
const MAX_SCORE = 900;

/** Clamp helper */
const clamp = (n) => Math.max(MIN_SCORE, Math.min(MAX_SCORE, n));

/** Structured JSON log helper */
function logTrustEvent(user, newScore, reason) {
    console.log(JSON.stringify({
        event: 'TrustScoreUpdated',
        user: user.walletAddress || user._id.toString(),
        newScore,
        reason
    }));
}

// ─── Action keys that are one-time bonuses (idempotency guards) ─────────────
const ACTION_FIRST_INSTALLMENT = 'First Installment Paid';
const ACTION_FIRST_FULL_REPAYMENT = 'First Loan Completed';
const ACTION_SBT_MINTED = 'SBT Minted';
const ACTION_KYC_VERIFIED = 'KYC Verified';

/**
 * Increase a user's trust score.
 *
 * Idempotency rules built-in:
 *  - ACTION_FIRST_INSTALLMENT   → guarded by user.hasReceivedFirstInstallmentBonus
 *  - ACTION_FIRST_FULL_REPAYMENT → guarded by user.hasReceivedFirstFullRepaymentBonus
 *
 * @param {string|ObjectId} userId
 * @param {number}          points   Positive value to add
 * @param {string}          reason   Human-readable label
 * @returns {Promise<number>}        New score after update
 */
exports.increaseScore = async (userId, points, reason) => {
    try {
        const id = userId?._id || userId;
        const user = await User.findById(id);
        if (!user) throw new Error(`User ${userId} not found`);

        // ── Idempotency guards ──────────────────────────────────────────────
        if (reason === ACTION_FIRST_INSTALLMENT) {
            if (user.hasReceivedFirstInstallmentBonus) {
                console.log(`[TrustScore] Skipped duplicate first-installment bonus for ${userId}`);
                return user.trustScore;
            }
            user.hasReceivedFirstInstallmentBonus = true;
        }

        if (reason === ACTION_FIRST_FULL_REPAYMENT) {
            if (user.hasReceivedFirstFullRepaymentBonus) {
                console.log(`[TrustScore] Skipped duplicate first-loan-completed bonus for ${userId}`);
                return user.trustScore;
            }
            user.hasReceivedFirstFullRepaymentBonus = true;
        }

        const oldScore = user.trustScore ?? MIN_SCORE;
        const newScore = clamp(oldScore + points);

        user.trustScore = newScore;
        user.trustHistory.push({
            action: reason,
            points: +points,
            newScore,
            timestamp: new Date()
        });

        await user.save();
        logTrustEvent(user, newScore, reason);

        return newScore;
    } catch (err) {
        console.error(`[TrustScore] increaseScore error (userId=${userId}):`, err.message);
        throw err;
    }
};

/**
 * Decrease a user's trust score.
 *
 * @param {string|ObjectId} userId
 * @param {number}          points   Positive value to subtract
 * @param {string}          reason   Human-readable label
 * @returns {Promise<number>}        New score after update
 */
exports.decreaseScore = async (userId, points, reason) => {
    try {
        const id = userId?._id || userId;
        const user = await User.findById(id);
        if (!user) throw new Error(`User ${userId} not found`);

        const oldScore = user.trustScore ?? MIN_SCORE;
        const newScore = clamp(oldScore - points);

        user.trustScore = newScore;
        user.trustHistory.push({
            action: reason,
            points: -Math.abs(points), // always negative for penalties
            newScore,
            timestamp: new Date()
        });

        await user.save();
        logTrustEvent(user, newScore, reason);

        return newScore;
    } catch (err) {
        console.error(`[TrustScore] decreaseScore error (userId=${userId}):`, err.message);
        throw err;
    }
};

// Export action constants so callers stay in sync
exports.ACTIONS = {
    SBT_MINTED: ACTION_SBT_MINTED,
    KYC_VERIFIED: ACTION_KYC_VERIFIED,
    FIRST_INSTALLMENT: ACTION_FIRST_INSTALLMENT,
    INSTALLMENT_PAID: 'Installment Paid',
    FIRST_LOAN_COMPLETED: ACTION_FIRST_FULL_REPAYMENT,
    INSTALLMENT_MISSED: 'Installment Missed',
    LOAN_DEFAULTED: 'Loan Defaulted',
};
