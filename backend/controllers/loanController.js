const LoanRequest = require('../models/LoanRequest');
const User = require('../models/User');
const trustScore = require('../services/trustScoreService');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load factory ABI + addresses for on-chain ad queries
const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const _agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/LoanAgreement.json'), 'utf8'));
const agreementAbi = Array.isArray(_agreementAbi) ? _agreementAbi : _agreementAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/addresses.json'), 'utf8'));

// @desc    Create a new loan request (Borrower action)
// @route   POST /api/loans
exports.createLoanRequest = async (req, res) => {
    try {
        let { borrowerId, amountRequested, interestRate, durationMonths, purpose, loanMode, simulatedSmartContractId } = req.body;

        // Verify user is an authorized borrower with an NFT
        const user = await User.findById(borrowerId);
        if (!user || user.role !== 'Borrower') {
            return res.status(403).json({ message: 'Only registered borrowers can request loans' });
        }
        if (!user.nftIssued && user.kycStatus !== 'FaceVerified' && user.kycStatus !== 'Verified') {
            return res.status(403).json({ message: 'You must complete KYC and mint an Identity NFT first' });
        }

        // ── ETH Loan Eligibility Gate (server-side, cannot be bypassed) ──
        // Interpret loanMode: 0 = ETH, 1 = ERC20.  Default to ERC20 for safety.
        loanMode = Number(loanMode ?? 1);

        if (user.completedLoans < 1) {
            // First-time borrowers MUST use ERC20 (autopay mandatory)
            if (loanMode === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Complete at least 1 loan before accessing ETH loans.'
                });
            }
            loanMode = 1; // Force ERC20 regardless of what was submitted
        } else if (loanMode === 0) {
            // Returning borrower requesting ETH loan — check trust score
            if ((user.trustScore ?? 300) < 700) {
                return res.status(403).json({
                    success: false,
                    message: 'Trust Score must be 700+ to unlock ETH loans.'
                });
            }
        }

        const loan = await LoanRequest.create({
            borrower: borrowerId,
            amountRequested,
            interestRate,
            durationMonths,
            purpose,
            loanMode,
            status: 'Pending',
            isActive: true,
            simulatedSmartContractId: simulatedSmartContractId || null
        });

        // Trigger matching engine in background
        const { runMatchingEngine } = require('../services/matchingService');
        runMatchingEngine().catch(err => console.error('[MatchingEngine] Trigger failed:', err));

        console.log(JSON.stringify({
            event: 'LoanCreated',
            loanId: loan._id.toString(),
            borrower: user.walletAddress || borrowerId,
            loanMode: loanMode === 0 ? 'ETH' : 'ERC20'
        }));

        res.status(201).json({ success: true, data: loan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all pending loan requests for the Feed (Lender action)
// @route   GET /api/loans
exports.getPendingLoans = async (req, res) => {
    try {
        // Validate MongoDB connection state
        const mongoose = require('mongoose');
        const dbState = mongoose.connection.readyState;
        // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
        if (dbState !== 1) {
            const states = { 0: 'Disconnected', 2: 'Connecting', 3: 'Disconnecting' };
            console.error('[getPendingLoans] MongoDB not ready. State:', states[dbState] || dbState);
            return res.status(503).json({
                success: false,
                message: `MongoDB not connected (state: ${states[dbState] || dbState}). Check your MONGO_URI.`
            });
        }

        const loans = await LoanRequest.find({ status: 'Pending' })
            .populate('borrower', 'trustScore walletAddress');

        console.log(`[getPendingLoans] Returning ${loans.length} pending loan(s)`);
        res.status(200).json({ success: true, count: loans.length, data: loans });
    } catch (error) {
        console.error('[getPendingLoans] Error:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch loans: ${error.message}`
        });
    }
};


// @desc    Accept and fund a loan request (Lender Action)
// @route   PUT /api/loans/:id/fund
exports.fundLoan = async (req, res) => {
    try {
        const { lenderId } = req.body;
        const loanId = req.params.id;

        const lender = await User.findById(lenderId);
        if (!lender || lender.role !== 'Lender') {
            return res.status(403).json({ message: 'Only registered lenders can fund loans' });
        }

        const loan = await LoanRequest.findById(loanId);
        if (!loan || loan.status !== 'Pending') {
            return res.status(400).json({ message: 'Loan is not available for funding' });
        }

        // Simulate Smart Contract Execution & Insurance Activation:
        const simulatedContractId = `0xSIMULATED${Date.now()}CONTRACT`;

        loan.lender = lenderId;
        loan.status = 'Funded';
        loan.simulatedSmartContractId = simulatedContractId;
        loan.insuranceActivated = true;

        await loan.save();

        // ── Trust Score: Lender gets +50 for first loan funded, +10 for subsequent ──
        try {
            const lenderLoanCount = await LoanRequest.countDocuments({ lender: lenderId, status: { $in: ['Funded', 'Repaid'] } });
            const isFirstFund = lenderLoanCount === 1;
            const scoreChange = isFirstFund ? 50 : 10;
            await trustScore.increaseScore(lenderId, scoreChange, 'Funded a Loan');
            console.log(`[TrustScore] Lender ${lenderId} +${scoreChange} (${isFirstFund ? 'first fund bonus' : 'subsequent fund'})`);
        } catch (tsErr) {
            console.error('[TrustScore] Lender update failed (non-critical):', tsErr.message);
        }

        // In real life, trigger Ethers.js to move funds from Lender Wallet -> Borrower Wallet

        res.status(200).json({
            success: true,
            message: 'Smart Contract Activated: Funds locked and transferred to borrower. Auto-repayment scheduled.',
            data: loan
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Get all loans associated with the logged in user (Borrower or Lender)
// @route   GET /api/loans/my
exports.getUserLoans = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Unassigned users have no loans to show yet
        if (user.role === 'Unassigned') {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        let query = {};
        if (user.role === 'Borrower') {
            query = { borrower: userId };
        } else if (user.role === 'Lender') {
            query = { lender: userId };
        }

        const loans = await LoanRequest.find(query)
            .populate('borrower', 'name walletAddress trustScore')
            .populate('lender', 'name walletAddress');

        res.status(200).json({ success: true, count: loans.length, data: loans });
    } catch (error) {
        console.error('[getUserLoans] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Sync repayment from frontend to backend
// @route   PUT /api/loans/:id/repay
exports.repayLoan = async (req, res) => {
    try {
        const { txHash } = req.body;
        const loan = await LoanRequest.findById(req.params.id).populate('borrower');

        if (!loan) return res.status(404).json({ message: 'Loan not found' });

        loan.status = 'Repaid';
        loan.repaymentTxHash = txHash || null;
        await loan.save();

        // ── Trust Score: full repayment lifecycle ──
        if (loan.borrower && loan.borrower._id) {
            try {
                const borrowerId = loan.borrower._id;

                // Re-fetch borrower to get fresh completedLoans count
                const borrowerUser = await require('../models/User').findById(borrowerId);
                if (borrowerUser) {
                    // 1) First-loan-completed bonus (one-time)
                    if (borrowerUser.completedLoans === 0) {
                        await trustScore.increaseScore(borrowerId, 100, trustScore.ACTIONS.FIRST_LOAN_COMPLETED);
                    }

                    // 2) Increment completedLoans counter
                    borrowerUser.completedLoans += 1;
                    await borrowerUser.save();

                    // 3) Standard full-repayment score bump (+75 for subsequent)
                    if (borrowerUser.completedLoans > 1) {
                        await trustScore.increaseScore(borrowerId, 75, 'Successful Repayment');
                    }

                    console.log(`[TrustScore] Borrower ${borrowerId} completedLoans → ${borrowerUser.completedLoans}`);
                }
            } catch (tsErr) {
                console.error('[TrustScore] Borrower repayment update failed (non-critical):', tsErr.message);
            }
        }

        res.status(200).json({ success: true, message: 'Loan status updated to Repaid' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all on-chain loan ads posted by the logged-in borrower (Factory)
// @route   GET /api/borrower/my-ads
exports.getBorrowerAds = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.walletAddress) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const factoryAddress = backendAddresses.loanFactory;
        if (!factoryAddress) {
            return res.status(200).json({ success: true, count: 0, data: [], warning: 'Factory contract not deployed' });
        }

        const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

        // Fetch request IDs for this borrower
        const requestIds = await factory.getBorrowerRequestIds(user.walletAddress);

        if (!requestIds || requestIds.length === 0) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // Fetch each request's details from the contract
        const ads = await Promise.all(
            requestIds.map(async (idBn) => {
                try {
                    const r = await factory.loanRequests(idBn);
                    const rMode = Number(r.mode) || 0;
                    const decimals = rMode === 0 ? 18 : 6;
                    const modeLabel = rMode === 0 ? 'ETH' : 'tUSDT';

                    // Determine status from on-chain state
                    const status = r.funded ? 'Funded' : 'Open';

                    return {
                        adId: Number(r.id),
                        principal: ethers.formatUnits(r.principal, decimals),
                        totalRepayment: ethers.formatUnits(r.totalRepayment, decimals),
                        repaymentInterval: Number(r.durationInMonths),
                        loanMode: modeLabel,
                        status,
                        agreementAddress: r.agreementAddress !== ethers.ZeroAddress ? r.agreementAddress : null,
                    };
                } catch (err) {
                    console.error('[getBorrowerAds] Failed to read request:', idBn.toString(), err.message);
                    return null;
                }
            })
        );

        const validAds = ads.filter(Boolean);
        res.status(200).json({ success: true, count: validAds.length, data: validAds });
    } catch (error) {
        console.error('[getBorrowerAds] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get upcoming receivable payments for the logged-in lender (Factory Agreements)
// @route   GET /api/loans/lender/upcoming-payments
exports.getLenderUpcomingPayments = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const targetWallet = req.query.walletAddress || user.walletAddress;

        if (!targetWallet) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const factoryAddress = backendAddresses.loanFactory;
        if (!factoryAddress) {
            return res.status(200).json({ success: true, count: 0, data: [], warning: 'Factory contract not deployed' });
        }

        const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

        // Get all agreement contract addresses for this lender
        const agreementAddresses = await factory.getLenderAgreements(targetWallet);
        console.log(`[getLenderUpcomingPayments] Lender ${targetWallet} has ${agreementAddresses.length} agreements`);

        if (!agreementAddresses || agreementAddresses.length === 0) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // Read each agreement concurrently
        const results = await Promise.all(
            agreementAddresses.map(async (agrAddr) => {
                try {
                    const agr = new ethers.Contract(agrAddr, agreementAbi, provider);

                    // Parallelize the three read calls
                    const [status, borrowerAddr, rawMode] = await Promise.all([
                        agr.getStatus(),
                        agr.borrower(),
                        agr.getLoanMode().catch(() => 0),
                    ]);

                    const mode = Number(rawMode);
                    const decimals = mode === 0 ? 18 : 6;
                    const loanMode = mode === 0 ? 'ETH' : 'tUSDT';

                    const completed = status._completed;
                    const remainingPayments = Number(status._remainingPayments);

                    // Only include active (not completed) agreements with payments still due
                    if (completed || remainingPayments === 0) {
                        console.log(`[getLenderUpcomingPayments] Skipping ${agrAddr} - completed: ${completed}, remaining: ${remainingPayments}`);
                        return null;
                    }

                    const nextDueTimestamp = Number(status._nextDueTimestamp);
                    const installmentAmount = ethers.formatUnits(status._monthlyPayment, decimals);
                    const isOverdue = status._isOverdue;
                    const missedPayments = Number(status._missedPayments);

                    console.log(`[getLenderUpcomingPayments] Included ${agrAddr}: Due ${nextDueTimestamp}, Amount ${installmentAmount}`);

                    return {
                        loanId: agrAddr,                          // agreement contract address acts as unique ID
                        borrowerAddress: borrowerAddr,
                        nextDueDate: nextDueTimestamp,            // Unix timestamp
                        nextDueDateISO: nextDueTimestamp > 0
                            ? new Date(nextDueTimestamp * 1000).toISOString()
                            : null,
                        installmentAmount,
                        loanMode,
                        remainingPayments,
                        missedPayments,
                        isOverdue,
                        autopay: mode === 1,                      // ERC20 = autopay enabled
                    };
                } catch (err) {
                    console.error('[getLenderUpcomingPayments] Failed to read agreement:', agrAddr, err.message);
                    return null;
                }
            })
        );

        // Filter nulls, sort by nextDueDate ascending (soonest first)
        const upcoming = results
            .filter(Boolean)
            .sort((a, b) => a.nextDueDate - b.nextDueDate);

        res.status(200).json({ success: true, count: upcoming.length, data: upcoming });
    } catch (error) {
        console.error('[getLenderUpcomingPayments] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── LENDER ADS (OFF-CHAIN MATCHING) ──────────────────────────────────────────

// @desc    Post a new Lender Ad
// @route   POST /api/loans/lender/ad
exports.postLenderAd = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user || user.role !== 'Lender') {
            return res.status(403).json({ success: false, message: 'Only registered Lenders can post ads' });
        }

        const { amountAvailable, minInterestRate, maxDuration, loanMode } = req.body;

        let modeNum = Number(loanMode ?? 1);

        // Validation: ERC20 token check
        if (modeNum === 1 && user.walletAddress) {
            const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const tokenAddress = backendAddresses.mockUSDT;

            if (tokenAddress) {
                const usdtAbi = ["function balanceOf(address) view returns (uint256)"];
                const tokenContract = new ethers.Contract(tokenAddress, usdtAbi, provider);
                const bal = await tokenContract.balanceOf(user.walletAddress);
                const balFmt = Number(ethers.formatUnits(bal, 6));

                if (balFmt < amountAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient tUSDT balance. You have ${balFmt}, but attempted to post an ad for ${amountAvailable}.`
                    });
                }
            }
        }

        const LenderAd = require('../models/LenderAd');
        const ad = await LenderAd.create({
            lenderAddress: user.walletAddress,
            amountAvailable,
            minInterestRate,
            maxDuration,
            loanMode: modeNum,
            isActive: true
        });

        // Trigger matching engine asynchronously
        const { runMatchingEngine } = require('../services/matchingService');
        runMatchingEngine().catch(err => console.error('[MatchingEngine] Trigger failed:', err));

        res.status(201).json({ success: true, data: ad });
    } catch (error) {
        console.error('[postLenderAd] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all ads for a specific lender
// @route   GET /api/loans/lender/my-ads
exports.getLenderAds = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (!user.walletAddress) return res.status(200).json({ success: true, count: 0, data: [] });

        const LenderAd = require('../models/LenderAd');
        const ads = await LenderAd.find({ lenderAddress: user.walletAddress })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: ads.length, data: ads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete (soft-delete) a specific Lender Ad
// @route   DELETE /api/loans/lender/ad/:id
exports.deleteLenderAd = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        const LenderAd = require('../models/LenderAd');
        const ad = await LenderAd.findById(req.params.id);

        if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

        // Security check
        if (ad.lenderAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this ad' });
        }

        ad.isActive = false;
        await ad.save();

        res.status(200).json({ success: true, message: 'Ad successfully deactivated', data: ad });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Register the deployed LoanAgreement contract address for auto-repay
// @route   POST /api/loans/register-agreement
// Called by Lend.jsx immediately after fundLoanRequest() tx confirms.
// Stores the real 0x... agreement address so autoRepayService can find it.
exports.registerAgreement = async (req, res) => {
    try {
        const { borrowerAddress, lenderAddress, agreementAddress, txHash } = req.body;

        if (!agreementAddress || !borrowerAddress) {
            return res.status(400).json({ success: false, message: 'agreementAddress and borrowerAddress required' });
        }

        // Validate it's a real Ethereum address
        let checksumAddr;
        try {
            checksumAddr = ethers.getAddress(agreementAddress);
        } catch {
            return res.status(400).json({ success: false, message: 'Invalid agreementAddress format' });
        }

        // Find the most recent Funded loan for this borrower that doesn't yet have an agreement address
        const borrower = await User.findOne({ walletAddress: { $regex: new RegExp(borrowerAddress, 'i') } });
        if (!borrower) {
            return res.status(404).json({ success: false, message: 'Borrower not found' });
        }

        // Look for a loan that belongs to this borrower with status Funded or Active and no agreement yet
        const loan = await LoanRequest.findOne({
            borrower: borrower._id,
            status: { $in: ['Funded', 'Active', 'Pending'] },
            $or: [
                { simulatedSmartContractId: { $exists: false } },
                { simulatedSmartContractId: null },
                // Also update if it has a numeric ID (old bug) instead of address
                { simulatedSmartContractId: { $not: /^0x[0-9a-fA-F]{40}$/ } }
            ]
        }).sort({ createdAt: -1 });

        if (!loan) {
            // If we can't find by the pattern, just find the latest funded loan for this borrower
            const latestLoan = await LoanRequest.findOne({
                borrower: borrower._id,
                status: { $in: ['Funded', 'Active'] }
            }).sort({ createdAt: -1 });

            if (latestLoan) {
                latestLoan.simulatedSmartContractId = checksumAddr;
                latestLoan.status = 'Funded';
                if (txHash) latestLoan.repaymentTxHash = txHash;
                await latestLoan.save();
                console.log(`[RegisterAgreement] Updated loan ${latestLoan._id} with agreement ${checksumAddr}`);
                return res.status(200).json({ success: true, loanId: latestLoan._id, agreementAddress: checksumAddr });
            }

            return res.status(404).json({ success: false, message: 'No matching loan found. Try funding from the marketplace.' });
        }

        loan.simulatedSmartContractId = checksumAddr;
        loan.status = 'Funded';
        if (txHash) loan.repaymentTxHash = txHash;
        await loan.save();

        console.log(`[RegisterAgreement] ✅ Loan ${loan._id} → Agreement ${checksumAddr}`);
        res.status(200).json({ success: true, loanId: loan._id, agreementAddress: checksumAddr });
    } catch (error) {
        console.error('[RegisterAgreement] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

