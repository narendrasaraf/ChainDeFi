const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const LoanRequest = require('../models/LoanRequest');
const TrustScoreHistory = require('../models/TrustScoreHistory');

// Load addresses and ABIs
const addressesPath = path.join(__dirname, '../contracts/addresses.json');
const microfinanceAbiPath = path.join(__dirname, '../contracts/Microfinance.json');
const soulboundAbiPath = path.join(__dirname, '../contracts/SoulboundIdentity.json');
const trustScoreAbiPath = path.join(__dirname, '../contracts/TrustScoreRegistry.json');
const loanFactoryAbiPath = path.join(__dirname, '../contracts/LoanAgreementFactory.json');

let addresses = {};
let microfinanceAbi = [];
let soulboundAbi = [];
let trustScoreAbi = [];
let loanFactoryAbi = [];

if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
}
if (fs.existsSync(microfinanceAbiPath)) {
    microfinanceAbi = JSON.parse(fs.readFileSync(microfinanceAbiPath, 'utf8'));
}
if (fs.existsSync(soulboundAbiPath)) {
    soulboundAbi = JSON.parse(fs.readFileSync(soulboundAbiPath, 'utf8'));
}
if (fs.existsSync(trustScoreAbiPath)) {
    trustScoreAbi = JSON.parse(fs.readFileSync(trustScoreAbiPath, 'utf8'));
}
if (fs.existsSync(loanFactoryAbiPath)) {
    loanFactoryAbi = JSON.parse(fs.readFileSync(loanFactoryAbiPath, 'utf8'));
}

const {
    RPC_URL,
    PRIVATE_KEY
} = process.env;

let provider;
let identityContract;
let microfinanceContract;
let trustScoreContract;
let loanFactoryContract;

/**
 * Helper function to manage robust Trust Score Updates (Local MongoDB only)
 */
async function updateTrustScore(userId, changeAmount, reason, loanId = null, metadata = {}) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const previousScore = user.trustScore;
        let newScore = previousScore + changeAmount;
        // Cap score between 0 and 1000
        newScore = Math.max(0, Math.min(1000, newScore));

        // Save to User Model
        user.trustScore = newScore;
        await user.save();

        // Save to History Log for ML/Analytics
        await TrustScoreHistory.create({
            user: userId,
            changeAmount,
            previousScore,
            newScore,
            reason,
            associatedLoan: loanId,
            metadata
        });

        console.log(`✅ Trust Score updated locally for User ${userId}: ${reason} -> ${previousScore} → ${newScore}`);
        return newScore;
    } catch (error) {
        console.error('Error updating trust score history:', error);
    }
}

/**
 * Connect to the blockchain provider and initialize contracts (READ-ONLY)
 */
function connectProvider() {
    if (!RPC_URL) {
        console.warn('⚠️ RPC_URL missing in .env. Blockchain service not initialized.');
        return;
    }

    try {
        // Backend acts as a listener AND authority for Trust Score updates
        provider = new ethers.JsonRpcProvider(RPC_URL);

        let signer = null;
        if (PRIVATE_KEY) {
            signer = new ethers.Wallet(PRIVATE_KEY, provider);
            console.log(`🔑 Authority Wallet Loaded: ${signer.address}`);
        }

        if (addresses.identity) {
            identityContract = new ethers.Contract(addresses.identity, soulboundAbi, provider);
        }

        if (addresses.microfinance) {
            microfinanceContract = new ethers.Contract(addresses.microfinance, microfinanceAbi, provider);
        }

        if (addresses.trustScore) {
            // Trust score updates require a signer (Authority/Owner)
            trustScoreContract = new ethers.Contract(addresses.trustScore, trustScoreAbi, signer || provider);
        }

        if (addresses.loanFactory) {
            loanFactoryContract = new ethers.Contract(addresses.loanFactory, loanFactoryAbi, provider);
        }

        console.log('✅ Blockchain service connected');
    } catch (error) {
        console.error('❌ Failed to connect to blockchain provider:', error);
    }
}


/**
 * Listen to critical Microfinance contract events and sync to MongoDB.
 * Using manual polling with queryFilter for higher reliability on public RPCs.
 */
async function listenToContractEvents() {
    if (!microfinanceContract) {
        console.warn('⚠️ Microfinance Contract not initialized. Cannot listen to events.');
        return;
    }

    console.log('🎧 Starting robust event polling for Microfinance...');

    let lastPolledBlock;
    try {
        lastPolledBlock = await provider.getBlockNumber();
    } catch (err) {
        console.warn('⚠️ Could not fetch initial block number (RPC error). Event polling will retry on next tick:', err.message);
        lastPolledBlock = 0;
    }

    // Poll interval - check every 15 seconds
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock <= lastPolledBlock) return;

            console.log(`🔍 Polling blocks ${lastPolledBlock + 1} to ${currentBlock}...`);

            // 0. Check for LoanCreated events (New Requests)
            const createdEvents = await microfinanceContract.queryFilter('LoanCreated', lastPolledBlock + 1, currentBlock);
            for (const event of createdEvents) {
                const { id: onChainId, borrower, amount, interest, duration } = event.args;
                console.log(`[Event] LoanCreated detected: Loan ${onChainId} by ${borrower}`);

                try {
                    const borrowerUser = await User.findOne({ walletAddress: borrower.toLowerCase() });

                    // Upsert logic: If front-end already sent some details, we might have a record
                    let loanReq = await LoanRequest.findOne({
                        borrower: borrowerUser?._id,
                        amountRequested: Number(ethers.formatEther(amount)),
                        status: 'Pending'
                    });

                    if (!loanReq) {
                        loanReq = new LoanRequest({
                            borrower: borrowerUser?._id,
                            amountRequested: Number(ethers.formatEther(amount)),
                            interestRate: Number(ethers.formatUnits(interest, 18)) * 100 / Number(ethers.formatEther(amount)), // Approximation
                            durationMonths: Math.round(Number(duration) / (30 * 24 * 60 * 60)),
                            purpose: 'On-chain Request',
                            status: 'Pending'
                        });
                    }

                    loanReq.simulatedSmartContractId = onChainId.toString();
                    await loanReq.save();
                    console.log(`[Event] LoanRequest synced: ${onChainId}`);
                } catch (err) {
                    console.error('Error processing LoanCreated event:', err);
                }
            }

            // 1. Check for LoanFunded events
            const fundedEvents = await microfinanceContract.queryFilter('LoanFunded', lastPolledBlock + 1, currentBlock);
            for (const event of fundedEvents) {
                const { id: onChainId, lender } = event.args;
                console.log(`[Event] LoanFunded detected: Loan ${onChainId} by ${lender}`);

                try {
                    const lenderUser = await User.findOne({ walletAddress: lender.toLowerCase() });
                    if (lenderUser) {
                        await updateTrustScore(lenderUser._id, 10, 'Funded a Loan', null, {
                            onChainLoanId: onChainId.toString()
                        });
                    }

                    const loanReq = await LoanRequest.findOne({ simulatedSmartContractId: onChainId.toString() });
                    if (loanReq) {
                        loanReq.status = 'Funded';
                        loanReq.fundingTxHash = event.transactionHash;
                        if (lenderUser) loanReq.lender = lenderUser._id;
                        await loanReq.save();
                    }
                } catch (err) {
                    console.error('Error processing LoanFunded event:', err);
                }
            }

            // 2. Check for LoanRepaid events
            const repaidEvents = await microfinanceContract.queryFilter('LoanRepaid', lastPolledBlock + 1, currentBlock);
            for (const event of repaidEvents) {
                const { id: onChainId, borrower } = event.args;
                console.log(`[Event] LoanRepaid detected: Loan ${onChainId} by ${borrower}`);

                try {
                    const loanReq = await LoanRequest.findOne({ simulatedSmartContractId: onChainId.toString() }).populate('borrower');
                    if (loanReq && loanReq.borrower) {
                        await updateTrustScore(loanReq.borrower._id, 25, 'Successful Repayment', loanReq._id, {
                            onChainLoanId: onChainId.toString()
                        });

                        // --- ON-CHAIN TRUST SCORE UPDATE ---
                        if (trustScoreContract && trustScoreContract.runner) {
                            try {
                                console.log(`[On-Chain] Incrementing trust score for borrower: ${borrower}`);
                                const tx = await trustScoreContract.increment(borrower);
                                console.log(`[On-Chain] Trust update TX sent: ${tx.hash}`);
                                await tx.wait();
                                console.log(`[On-Chain] Trust score incremented successfully.`);
                            } catch (error) {
                                console.error(`[On-Chain] Failed to increment trust score:`, error.message);
                            }
                        }

                        loanReq.status = 'Repaid';
                        loanReq.repaymentTxHash = event.transactionHash;
                        await loanReq.save();
                    }
                } catch (err) {
                    console.error('Error processing LoanRepaid event:', err);
                }
            }

            lastPolledBlock = currentBlock;
        } catch (error) {
            console.warn('⚠️ Microfinance Event polling warning:', error.message);
        }

        // Factory Polling
        if (loanFactoryContract) {
            try {
                const currentBlock = await provider.getBlockNumber();

                // 1. Check for LoanRequested (New Installment Loan Ads)
                const requestedEvents = await loanFactoryContract.queryFilter('LoanRequested', lastPolledBlock + 1, currentBlock);
                for (const event of requestedEvents) {
                    const { id: onChainId, borrower, principal, mode } = event.args;
                    console.log(`[FactoryEvent] LoanRequested detected: ID ${onChainId} by ${borrower}`);

                    try {
                        const borrowerUser = await User.findOne({ walletAddress: borrower.toLowerCase() });
                        let loanReq = await LoanRequest.findOne({ simulatedSmartContractId: onChainId.toString() });

                        if (!loanReq) {
                            loanReq = new LoanRequest({
                                borrower: borrowerUser?._id,
                                amountRequested: Number(ethers.formatUnits(principal, mode === 0 ? 18 : 6)),
                                status: 'Pending',
                                simulatedSmartContractId: onChainId.toString(),
                                loanMode: Number(mode),
                                purpose: 'On-chain Factory Request'
                            });
                            await loanReq.save();
                            console.log(`[FactoryEvent] New LoanRequest synced: ${onChainId}`);
                        }
                    } catch (err) {
                        console.error('Error processing LoanRequested event:', err);
                    }
                }

                // 2. Check for LoanFunded (Installment Loan Funded)
                const fundedEvents = await loanFactoryContract.queryFilter('LoanFunded', lastPolledBlock + 1, currentBlock);
                for (const event of fundedEvents) {
                    const { id: onChainId, lender, agreementAddress } = event.args;
                    console.log(`[FactoryEvent] LoanFunded detected: ID ${onChainId} by ${lender}`);

                    try {
                        const loanReq = await LoanRequest.findOne({ simulatedSmartContractId: onChainId.toString() });
                        if (loanReq) {
                            loanReq.status = 'Funded';
                            loanReq.simulatedSmartContractId = agreementAddress; // Switch to Agreement Address!
                            loanReq.fundingTxHash = event.transactionHash;

                            const lenderUser = await User.findOne({ walletAddress: lender.toLowerCase() });
                            if (lenderUser) loanReq.lender = lenderUser._id;

                            await loanReq.save();
                            console.log(`[FactoryEvent] Loan ${onChainId} updated to Funded (Agr: ${agreementAddress})`);
                        }
                    } catch (err) {
                        console.error('Error processing LoanFunded event:', err);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Factory Event polling warning:', error.message);
            }
        }
    }, 15000); // Poll every 15 seconds
}


module.exports = {
    connectProvider,
    listenToContractEvents,
    updateTrustScore
};

