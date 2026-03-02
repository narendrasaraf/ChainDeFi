'use strict';
/**
 * autoRepayService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend automation engine for LoanAgreement installment repayments.
 *
 * How it works:
 *  1. Cron fires every 60 seconds.
 *  2. Fetches all 'Funded' LoanRequests that have an on-chain agreementAddress.
 *  3. For each agreement, reads getStatus() directly from the chain.
 *  4. If block.timestamp >= nextDueTimestamp AND loan is not completed:
 *       → Calls agreement.repayInstallment() using the backend signer
 *         (automationService wallet).
 *       → token.transferFrom(borrower, lender, amount) is executed on-chain.
 *         Borrower MUST have approved the agreement contract for >= monthlyPayment tUSDT.
 *  5. On success: logs, updates DB status, records trust score.
 *  6. On failure: logs revert reason, records missed payment in DB.
 *
 * .env required:
 *   SEPOLIA_RPC_URL   — Sepolia JSON-RPC endpoint
 *   PRIVATE_KEY       — Backend automation wallet private key
 *                       This wallet == automationService in every LoanAgreement.
 */

const cron = require('node-cron');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const LoanRequest = require('../models/LoanRequest');
const User = require('../models/User');
const TrustScoreHistory = require('../models/TrustScoreHistory');
const trustScore = require('./trustScoreService');

// ── ABI & Addresses ───────────────────────────────────────────────────────────
const ADDRESSES_PATH = path.join(__dirname, '../contracts/addresses.json');
const AGREEMENT_ABI_PATH = path.join(__dirname, '../contracts/LoanAgreement.json');
const USDT_ABI_PATH = path.join(__dirname, '../contracts/MockUSDT.json');

let addresses = {};
let agreementAbi = [];
let usdtAbi = [];

if (fs.existsSync(ADDRESSES_PATH)) addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
if (fs.existsSync(AGREEMENT_ABI_PATH)) agreementAbi = JSON.parse(fs.readFileSync(AGREEMENT_ABI_PATH, 'utf8'));
if (fs.existsSync(USDT_ABI_PATH)) usdtAbi = JSON.parse(fs.readFileSync(USDT_ABI_PATH, 'utf8'));

// Support both { abi: [...] } wrapped and flat array formats
if (agreementAbi && agreementAbi.abi) agreementAbi = agreementAbi.abi;
if (usdtAbi && usdtAbi.abi) usdtAbi = usdtAbi.abi;

// ── Signer & Provider ─────────────────────────────────────────────────────────
let provider;
let signerWallet;

function initSigner() {
    const rpc = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
    const pk = process.env.PRIVATE_KEY;

    if (!rpc || !pk) {
        console.error('[AutoRepay] ❌  SEPOLIA_RPC_URL or PRIVATE_KEY missing in .env');
        return false;
    }
    provider = new ethers.JsonRpcProvider(rpc);
    signerWallet = new ethers.Wallet(pk, provider);
    console.log(`[AutoRepay] 🔑  Signer loaded: ${signerWallet.address}`);
    return true;
}

// ── Email (fire-and-forget) ───────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
        console.log(`[AutoRepay] 📧  Email sent → ${to}`);
    } catch (err) {
        console.warn('[AutoRepay] ⚠️   Email send failed (non-critical):', err.message);
    }
}


// ── Core: process one agreement ───────────────────────────────────────────────

async function processAgreement(loanDoc, agreementAddress) {
    const tag = `[AutoRepay][${agreementAddress.slice(0, 8)}]`;

    // 1. Read on-chain status
    let status, loanStatusEnum, modeEnum;
    try {
        const agr = new ethers.Contract(agreementAddress, agreementAbi, provider);
        status = await agr.getStatus();
        try {
            loanStatusEnum = await agr.getLoanStatus();
            modeEnum = await agr.getLoanMode(); // 0: ETH, 1: ERC20
        } catch {
            loanStatusEnum = 0; // Legacy fallback
            modeEnum = 0; // Legacy fallback (ETH)
        }
    } catch (readErr) {
        console.error(JSON.stringify({ event: 'Read Error', agreement: agreementAddress, error: readErr.message }));
        return;
    }

    // 2. Skip automation for ETH loans
    if (modeEnum === 0n || modeEnum === 0) {
        console.log(JSON.stringify({ event: 'AutopaySkipped', reason: 'ETH loan', loanId: loanDoc._id.toString() }));
        return;
    }

    // loanStatusEnum => 0: Active, 1: Completed, 2: Defaulted
    console.log(`[Diagnostic] Agrmnt=${agreementAddress.slice(0, 8)} | statusEnum=${loanStatusEnum} | modeEnum=${modeEnum}`);
    if (loanStatusEnum === 1n || status._completed) {
        console.log(JSON.stringify({ event: 'Loan Completed', loanId: loanDoc._id.toString(), agreement: agreementAddress }));
        if (loanDoc.status !== 'Repaid') {
            loanDoc.status = 'Repaid';
            await loanDoc.save();
        }
        return;
    }

    if (loanStatusEnum === 2n || Number(status._missedPayments) > 3) {
        console.log(JSON.stringify({ event: 'Loan Defaulted', loanId: loanDoc._id.toString(), agreement: agreementAddress }));
        if (loanDoc.status !== 'Defaulted') {
            loanDoc.status = 'Defaulted';
            await loanDoc.save();
            // Apply -150 for loan default (one-time, only when first transitioning to Defaulted)
            if (loanDoc.borrower) {
                try {
                    await trustScore.decreaseScore(loanDoc.borrower, 150, trustScore.ACTIONS.LOAN_DEFAULTED);
                } catch (tsErr) {
                    console.warn('[AutoRepay] ⚠️   TrustScore default penalty failed:', tsErr.message);
                }
            }
        }
        return;
    }


    const {
        _paymentsMade,
        _totalDuration,
        _nextDueTimestamp,
        _monthlyPayment,
        _remainingPayments,
        _completed,
        _missedPayments,
        _isOverdue,
        _borrowerAllowance
    } = status;

    console.log(`[Diagnostic] _remainingPayments = ${Number(_remainingPayments)}`);
    if (Number(_remainingPayments) === 0) return;

    const latestBlock = await provider.getBlock('latest');
    const blockTs = latestBlock.timestamp;
    const dueSec = Number(_nextDueTimestamp);
    const diffSecs = dueSec - blockTs;
    const monthlyAmt = _monthlyPayment;   // BigInt (raw token units, 6 decimals)

    // Log detailed diagnostics per user request
    const agr = new ethers.Contract(agreementAddress, agreementAbi, provider);
    const tokenAddress = await agr.token();
    const tokenContract = new ethers.Contract(tokenAddress, usdtAbi, provider);
    const borrowerAddress = loanDoc.borrower?.walletAddress || loanDoc.borrower;
    const bal = await tokenContract.balanceOf(borrowerAddress);

    console.log(`\n[AutoRepay] 🔍 Deep Diagnostic — Loan: ${loanDoc._id} | Agrmnt: ${agreementAddress}`);
    console.log(`- Block Timestamp: ${blockTs}`);
    console.log(`- Next Due Date  : ${dueSec}`);
    console.log(`- Difference Secs: ${diffSecs} (negative means overdue)`);
    console.log(`- Loan Mode      : ${modeEnum === 0n || modeEnum === 0 ? 'ETH' : 'ERC20'}`);
    console.log(`- Loan Status    : ${loanStatusEnum}`);
    console.log(`- Borrower Bal   : ${ethers.formatUnits(bal, 6)} tUSDT`);
    console.log(`- Allowance      : ${ethers.formatUnits(_borrowerAllowance, 6)} tUSDT`);

    // 3. Not yet due — nothing to do
    if (blockTs < dueSec) {
        console.log(`Autopay skipped - too early (${diffSecs}s remaining)`);
        return;
    }

    console.log(`Autopay condition met`);

    console.log(`${tag} 🔔  Payment due! Paid ${Number(_paymentsMade)}/${Number(_totalDuration)}`);

    // 4. Check borrower has approved enough tokens
    const allowance = _borrowerAllowance;   // BigInt
    if (allowance < monthlyAmt) {
        const needed = ethers.formatUnits(monthlyAmt, 6);
        const hasAllowance = ethers.formatUnits(allowance, 6);
        console.warn(`${tag} ⚠️   Insufficient allowance. Need ${needed} tUSDT, approved ${hasAllowance} tUSDT.`);

        // Mark missed payment locally
        loanDoc.status = loanDoc.status === 'Funded' ? 'Funded' : loanDoc.status; // keep status
        if (!loanDoc.metadata) loanDoc.set('metadata', {}, { strict: false });
        await loanDoc.save();

        // Penalise trust score off-chain
        if (loanDoc.borrower) {
            try {
                const bId = loanDoc.borrower?._id || loanDoc.borrower;
                await trustScore.decreaseScore(bId, 50, trustScore.ACTIONS.INSTALLMENT_MISSED);
            } catch (err) {
                console.warn('[AutoRepay] ⚠️   TrustScore decrease failed:', err.message);
            }
        }

        // Notify borrower (Email disabled per request)

        return;
    }

    // 5. Execute repayInstallment() on-chain (with max 2 attempts retry logic)
    try {
        const agrWithSigner = new ethers.Contract(agreementAddress, agreementAbi, signerWallet);
        let receipt = null;
        let tx = null;
        let attempts = 0;
        const maxAttempts = 2;

        console.log(JSON.stringify({ event: 'AutopayExecuted', loanId: loanDoc._id.toString() }));

        while (attempts < maxAttempts && !receipt) {
            try {
                attempts++;

                // Estimate gas before calling to catch reverts early
                let gasEst;
                try {
                    gasEst = await agrWithSigner.repayInstallment.estimateGas();
                    console.log(`- Gas Est: ${gasEst.toString()}`);
                } catch (gasErr) {
                    console.error(`Autopay failed - revert reason during gas estimation:`);
                    console.error(`- error.reason: ${gasErr.reason}`);
                    console.error(`- error.data: ${gasErr.data}`);
                    console.error(`- error.stack: ${gasErr.stack}`);
                    throw gasErr;
                }

                tx = await agrWithSigner.repayInstallment({ gasLimit: gasEst * 120n / 100n });
                console.log(`- Tx Hash: ${tx.hash}`);
                receipt = await tx.wait();
                console.log(`Autopay success`);
            } catch (err) {
                if (attempts === maxAttempts) {
                    console.error(`Autopay failed - revert reason:`);
                    console.error(`- error.reason: ${err.reason}`);
                    console.error(`- error.data: ${err.data}`);
                    console.error(`- error.stack: ${err.stack}`);
                    throw err;
                }
                console.log(JSON.stringify({ event: 'Transaction Retry', agreement: agreementAddress, attempt: attempts }));
            }
        }

        console.log(JSON.stringify({
            event: 'Installment Paid',
            loanId: loanDoc._id.toString(),
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            paymentsMade: Number(_paymentsMade) + 1
        }));

        // 6. Update DB
        loanDoc.repaymentTxHash = tx.hash;
        if (Number(_remainingPayments) === 1) {
            // This was the last payment
            loanDoc.status = 'Repaid';
            console.log(`${tag} 🏁  Final installment — marking Repaid in DB.`);
        }
        await loanDoc.save();

        // 7. Reward trust score
        if (loanDoc.borrower) {
            try {
                const bId = loanDoc.borrower?._id || loanDoc.borrower;
                const isFirstInstallment = !loanDoc.firstInstallmentRewarded;

                if (isFirstInstallment) {
                    // +50 first-installment bonus (idempotent per-loan guard)
                    await trustScore.increaseScore(bId, 50, trustScore.ACTIONS.FIRST_INSTALLMENT);
                    loanDoc.firstInstallmentRewarded = true;
                    // Don't await save here, will save once at end of function
                } else {
                    // +20 for each subsequent installment
                    await trustScore.increaseScore(bId, 20, trustScore.ACTIONS.INSTALLMENT_PAID);
                }

                // If this was the FINAL payment, handle completedLoans + milestone bonus
                if (Number(_remainingPayments) === 1) {
                    const borrowerUser = await User.findById(bId);
                    if (borrowerUser) {
                        if ((borrowerUser.completedLoans || 0) === 0) {
                            await trustScore.increaseScore(bId, 100, trustScore.ACTIONS.FIRST_LOAN_COMPLETED);
                        }
                        borrowerUser.completedLoans = (borrowerUser.completedLoans ?? 0) + 1;
                        await borrowerUser.save();
                        console.log(`[AutoRepay] 🏆  completedLoans → ${borrowerUser.completedLoans} for ${bId}`);
                    }
                }
            } catch (tsErr) {
                console.warn('[AutoRepay] ⚠️   TrustScore reward failed:', tsErr.message);
            }
        }
        await loanDoc.save();

        // 8. Success email
        try {
            const borrowerUser = await User.findById(loanDoc.borrower);
            if (borrowerUser?.email) {
                const paid = ethers.formatUnits(monthlyAmt, 6);
                const paidNum = Number(_paymentsMade) + 1;
                await sendEmail(
                    borrowerUser.email,
                    '✅  PanCred: Installment Paid Successfully',
                    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
                        <h2 style="color:#22c55e;">Installment #${paidNum} Paid</h2>
                        <p>Hi ${borrowerUser.name},</p>
                        <p>Your installment of <strong>${paid} tUSDT</strong> has been processed automatically.</p>
                        <p>Installments paid: <strong>${paidNum} / ${Number(_totalDuration)}</strong></p>
                        <p>Transaction: <a href="https://sepolia.etherscan.io/tx/${tx.hash}">${tx.hash.slice(0, 20)}...</a></p>
                        <p style="color:#22c55e;">Your trust score has been updated! 🎉</p>
                    </div>`
                );
            }
        } catch (_) { /* non-critical */ }

    } catch (txErr) {
        // 9. On-chain call failed
        const reason = txErr.reason || txErr.message?.slice(0, 120) || 'Unknown error';
        console.log(JSON.stringify({ event: 'Installment Missed', loanId: loanDoc._id.toString(), reason: reason }));

        // Penalise trust score
        if (loanDoc.borrower) {
            try {
                await trustScore.decreaseScore(loanDoc.borrower, 50, trustScore.ACTIONS.INSTALLMENT_MISSED);
            } catch (tsErr) {
                console.warn('[AutoRepay] ⚠️   TrustScore decrease failed:', tsErr.message);
            }
        }

        // Failure notification (Email disabled per request)
    }
}

// ── Main Cron Tick ────────────────────────────────────────────────────────────
let isRunning = false;
async function runRepaymentCycle() {
    if (isRunning) return;
    isRunning = true;
    try {
        console.log(`\n[AutoRepay] ⏰  Cron tick — ${new Date().toISOString()}`);

        if (!signerWallet) {
            console.warn('[AutoRepay] No signer — skipping tick.');
            return;
        }

        // Fetch all Funded loans that have an on-chain agreement address
        let loans;
        try {
            loans = await LoanRequest.find({
                status: { $in: ['Funded', 'Active'] },
                simulatedSmartContractId: { $exists: true, $ne: null }
            }).populate('borrower', '_id email name trustScore walletAddress');
        } catch (dbErr) {
            console.error('[AutoRepay] ❌  DB query failed:', dbErr.message);
            return;
        }

        if (!loans.length) {
            console.log('[AutoRepay] 📭  No active funded loans found.');
            return;
        }

        console.log(`[AutoRepay] 📋  Processing ${loans.length} active loan(s)...`);

        // Process sequentially to avoid RPC rate-limit hammering
        for (const loan of loans) {
            let agreementAddress = loan.simulatedSmartContractId;

            // Validate it looks like an Ethereum address (factory-deployed agreements)
            try {
                agreementAddress = ethers.getAddress(agreementAddress.toLowerCase());
            } catch (e) {
                console.log(`[AutoRepay] Invalid checksum or address: ${agreementAddress}`);
                continue;
            }

            // Just note if newly created and processing for the first time
            if (!loan.onChainProcessed) {
                console.log(JSON.stringify({ event: 'Loan Created', loanId: loan._id.toString(), agreement: agreementAddress }));
                loan.onChainProcessed = true;
                await loan.save();
            }

            await processAgreement(loan, agreementAddress);
        }

        console.log(`[AutoRepay] ✔️   Cycle complete.\n`);
    } finally {
        isRunning = false;
    }
}

// ── Start ─────────────────────────────────────────────────────────────────────
function startAutoRepayScheduler() {
    if (!initSigner()) {
        console.error('[AutoRepay] ⛔  Scheduler not started — missing env vars.');
        return;
    }

    console.log('[AutoRepay] 🟢  Starting scheduler — interval: every 60 seconds');

    // Fire immediately on start, then every 60 seconds
    runRepaymentCycle();
    cron.schedule('* * * * *', runRepaymentCycle); // every 60s (every minute)
}

// ── Manual Trigger ────────────────────────────────────────────────────────────
async function forceAutoPay(loanId) {
    console.log(`\n[AutoRepay] 🛠️ Manual Trigger: force-autopay for loan ${loanId}`);
    try {
        if (!initSigner()) {
            throw new Error('Signer missing - check env vars');
        }
        const loan = await LoanRequest.findById(loanId).populate('borrower', '_id email name trustScore walletAddress');
        if (!loan) {
            console.log(`[AutoRepay] ❌ Loan not found.`);
            return { success: false, message: 'Loan not found' };
        }
        if (!loan.simulatedSmartContractId) {
            console.log(`[AutoRepay] ❌ Loan has no smart contract ID.`);
            return { success: false, message: 'Loan not yet funded/deployed on-chain' };
        }
        await processAgreement(loan, loan.simulatedSmartContractId);
        return { success: true, message: 'Manual trigger completed, check logs for details' };
    } catch (err) {
        console.error(`[AutoRepay] ❌ Manual Trigger Error:`, err);
        return { success: false, message: err.message };
    }
}

module.exports = { startAutoRepayScheduler, forceAutoPay };
