const mongoose = require('mongoose');
const LoanRequest = require('../models/LoanRequest');
const LenderAd = require('../models/LenderAd');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Setup Contract Context
const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/addresses.json'), 'utf8'));

// Initialize Backend Signer
function getAutomationSigner() {
    const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const pvtKey = process.env.PRIVATE_KEY;
    if (!pvtKey) throw new Error('Missing PRIVATE_KEY for automationService');
    return new ethers.Wallet(pvtKey, provider);
}

/**
 * Triggers the matching engine. Safe to call concurrently; uses MongoDB Transactions.
 */
async function runMatchingEngine() {
    console.log('[MatchingEngine] 🔍 Waking up to find matches...');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find all active Borrower Ads (pending loans)
        const pendingBorrowers = await LoanRequest.find({
            status: 'Pending',
            isActive: true
        }).populate('borrower').session(session);

        if (pendingBorrowers.length === 0) {
            await session.commitTransaction();
            session.endSession();
            return;
        }

        // 2. Find all active Lender Ads
        const activeLenders = await LenderAd.find({
            isActive: true,
            amountAvailable: { $gt: 0 }
        }).session(session);

        if (activeLenders.length === 0) {
            await session.commitTransaction();
            session.endSession();
            return;
        }

        // 3. Simple Greedy Matcher
        let matchedPairs = [];

        for (const b of pendingBorrowers) {
            if (!b.isActive) continue; // Skip if matched in an earlier iteration this loop

            for (const l of activeLenders) {
                if (!l.isActive) continue;

                // Match Criteria
                if (
                    b.loanMode === l.loanMode &&
                    l.amountAvailable >= b.amountRequested &&
                    b.interestRate >= l.minInterestRate &&
                    b.durationMonths <= l.maxDuration
                ) {
                    console.log(`[MatchingEngine] 🤝 MATCH FOUND! Borrower: ${b.borrower.walletAddress} <-> Lender: ${l.lenderAddress}`);

                    // Lock states
                    b.isActive = false;
                    b.status = 'Funded';
                    // Temporarily mock lender ID if needed, or query it
                    const lenderUser = await mongoose.model('User').findOne({ walletAddress: l.lenderAddress }).session(session);
                    if (lenderUser) {
                        b.lender = lenderUser._id;
                    }

                    l.amountAvailable -= b.amountRequested;
                    if (l.amountAvailable === 0) {
                        l.isActive = false;
                    }

                    b.insuranceActivated = true; // Auto-activate insurance for factory deployed loans

                    await b.save({ session });
                    await l.save({ session });

                    matchedPairs.push({ borrowerReq: b, lenderAd: l });
                    break; // Move to next borrower Ad
                }
            }
        }

        await session.commitTransaction();
        session.endSession();

        // 4. Post-Transaction: Execute On-Chain Deployments
        if (matchedPairs.length > 0) {
            await executeOnChainMatches(matchedPairs);
        } else {
            console.log('[MatchingEngine] 💨 No valid matches found this cycle.');
        }

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('[MatchingEngine] ❌ Critical Error during matching:', error);
    }
}

async function executeOnChainMatches(pairs) {
    if (pairs.length === 0) return;

    let signer;
    try {
        signer = getAutomationSigner();
    } catch (err) {
        console.error('[MatchingEngine] ⚠️ Cannot execute on-chain:', err.message);
        return;
    }

    const factoryAddress = backendAddresses.loanFactory;
    const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);

    for (const pair of pairs) {
        const { borrowerReq: b, lenderAd: l } = pair;
        console.log(`[MatchingEngine] ⚡ Executing match on-chain for Loan ${b._id}...`);

        try {
            // mode: 0 = ETH, 1 = ERC20
            const decimals = b.loanMode === 0 ? 18 : 6;
            const principalBn = ethers.parseUnits(b.amountRequested.toString(), decimals);

            // Compute totalRepayment = principal * (1 + interestRate/100)
            const interestDecimal = b.interestRate / 100;
            const totalFactor = 1 + interestDecimal;
            const totalRepaymentRaw = b.amountRequested * totalFactor;
            const totalRepaymentBn = ethers.parseUnits(totalRepaymentRaw.toFixed(decimals), decimals);

            let valueToSend = 0n;
            if (b.loanMode === 0) {
                valueToSend = principalBn; // Backend proxies the ETH
            }

            console.log(JSON.stringify({
                event: 'LoanMatched',
                borrower: b.borrower.walletAddress,
                lender: l.lenderAddress,
                mode: b.loanMode === 0 ? 'ETH' : 'ERC20'
            }));

            const tx = await factory.deployMatchedLoan(
                b.borrower.walletAddress,
                l.lenderAddress,
                principalBn,
                totalRepaymentBn,
                b.durationMonths,
                b.loanMode,
                { value: valueToSend }
            );

            console.log(`[MatchingEngine] ⏳ Waiting for confirmation (Tx: ${tx.hash})...`);
            const receipt = await tx.wait();

            // Find the agreementAddress from the LoanFunded event
            const eventTopic = factory.interface.getEvent('LoanFunded').topicHash;
            let agreementAddress = null;

            for (const log of receipt.logs) {
                if (log.topics[0] === eventTopic) {
                    const parsed = factory.interface.parseLog(log);
                    agreementAddress = parsed.args[2]; // arg index 2 is agreementAddress
                    break;
                }
            }

            console.log(JSON.stringify({
                event: 'LoanDeployed',
                contract: agreementAddress,
                mode: b.loanMode === 0 ? 'ETH' : 'ERC20'
            }));

            // Sync DB with real contract hash mapping
            b.simulatedSmartContractId = agreementAddress;
            b.fundingTxHash = tx.hash;
            b.onChainProcessed = true;
            await b.save();

        } catch (err) {
            console.error(`[MatchingEngine] ❌ On-chain execution failed for loan ${b._id}:`, err);
            // Reverse the off-chain match if blockchain failed?
            // For hackathon: just log it. The cron will retry missing onChainProcessed=false later.
        }
    }
}

module.exports = { runMatchingEngine };
