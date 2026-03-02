import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { ethers } from 'ethers';
import { useAccount, useConfig, useWalletClient } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiLoader, FiTrendingUp, FiCheckCircle, FiInfo, FiSearch, FiGlobe, FiCalendar, FiDollarSign, FiShield, FiAlertCircle, FiClock, FiZap } from 'react-icons/fi';


import addresses from '../contracts/addresses.json';
import _microfinanceJson from '../contracts/Microfinance.json';
// Support both { abi: [...] } wrapped format and raw array format
const microfinanceAbi = Array.isArray(_microfinanceJson) ? _microfinanceJson : _microfinanceJson.abi;
import trustScoreAbi from '../contracts/TrustScoreRegistry.json';
import _factoryJson from '../contracts/LoanAgreementFactory.json';
import _agreementJson from '../contracts/LoanAgreement.json';
const factoryAbi = Array.isArray(_factoryJson) ? _factoryJson : _factoryJson.abi;
const agreementAbi = Array.isArray(_agreementJson) ? _agreementJson : _agreementJson.abi;
import _mockUSDTJson from '../contracts/MockUSDT.json';
const tUSDTAbi = Array.isArray(_mockUSDTJson) ? _mockUSDTJson : _mockUSDTJson.abi;
import { parseBlockchainError, checkIdentityOwnership, getSharedProvider } from '../blockchainService';
import TransactionAccordion from '../components/TransactionAccordion';


const LenderDashboard = () => {
    const { userProfile, token } = useAuth();
    const { address: walletAddress, isConnected, chainId } = useAccount();
    const config = useConfig();
    const { data: walletClient } = useWalletClient();
    const navigate = useNavigate();

    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [onChainLoans, setOnChainLoans] = useState({ created: [], funded: [] });
    const [onChainLoading, setOnChainLoading] = useState(false);

    // Factory lender agreements
    const [lenderAgreements, setLenderAgreements] = useState([]);
    const [lenderAgreementsLoading, setLenderAgreementsLoading] = useState(false);

    const [tUSDTBalance, setTUSDTBalance] = useState("0.00");
    const [claimingFaucet, setClaimingFaucet] = useState(false);

    // SBT Identity status for the lender
    const [hasIdentity, setHasIdentity] = useState(false);
    const [identityChecking, setIdentityChecking] = useState(true);

    // Upcoming receivables from active factory agreements
    const [upcomingPayments, setUpcomingPayments] = useState([]);
    const [upcomingLoading, setUpcomingLoading] = useState(false);

    // --- LENDER ADS (AUTO-MATCHING) ---
    const [myAds, setMyAds] = useState([]);
    const [adsLoading, setAdsLoading] = useState(false);
    const [postingAd, setPostingAd] = useState(false);

    // Ad Form State
    const [adAmount, setAdAmount] = useState('');
    const [adMinInterest, setAdMinInterest] = useState('');
    const [adMaxDuration, setAdMaxDuration] = useState('');
    const [adLoanMode, setAdLoanMode] = useState(1); // Default to ERC20/tUSDT


    useEffect(() => {
        fetchLoans();
        verifyIdentity();
        fetchOnChainLoans();

        // Event listeners for real-time updates
        const provider = getSharedProvider();
        const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, provider);

        const handleUpdate = () => {
            fetchLoans();
            fetchOnChainLoans();
        };

        contract.on("LoanCreated", handleUpdate);
        contract.on("LoanFunded", handleUpdate);
        contract.on("LoanRepaid", handleUpdate);

        return () => {
            contract.off("LoanCreated", handleUpdate);
            contract.off("LoanFunded", handleUpdate);
            contract.off("LoanRepaid", handleUpdate);
        };
    }, [walletAddress]);

    // ─── Fetch factory funded agreements for this lender ───────────────────
    const fetchLenderAgreements = async () => {
        if (!walletAddress || !addresses.loanFactory) return;
        setLenderAgreementsLoading(true);
        try {
            const provider = walletClient
                ? new ethers.BrowserProvider(walletClient.transport)
                : getSharedProvider();

            const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, provider);
            const addrs = await factory.getLenderAgreements(walletAddress);
            console.log('[LenderDashboard] factory lender agreements:', addrs.length);

            const details = await Promise.all(addrs.map(async (addr) => {
                try {
                    const agr = new ethers.Contract(addr, agreementAbi, provider);
                    const status = await agr.getStatus();

                    let mode = 0;
                    try { mode = Number(await agr.getLoanMode()); } catch { mode = 0; }

                    return {
                        address: addr,
                        mode,
                        paymentsMade: Number(status._paymentsMade),
                        totalDuration: Number(status._totalDuration),
                        nextDueTimestamp: Number(status._nextDueTimestamp),
                        monthlyPayment: mode === 0 ? ethers.formatEther(status._monthlyPayment) : ethers.formatUnits(status._monthlyPayment, 6),
                        remainingPayments: Number(status._remainingPayments),
                        completed: status._completed,
                        missedPayments: Number(status._missedPayments),
                        isOverdue: status._isOverdue,
                    };
                } catch (e) {
                    console.error('[LenderDashboard] Failed to read agreement:', addr, e);
                    return null;
                }
            }));
            setLenderAgreements(details.filter(Boolean));
        } catch (err) {
            console.error('[LenderDashboard] fetchLenderAgreements error:', err);
        } finally {
            setLenderAgreementsLoading(false);
        }
    };

    const fetchUpcomingPayments = async () => {
        if (!token && !userProfile?.token) return;
        setUpcomingLoading(true);
        try {
            const res = await api.get('/loans/lender/upcoming-payments', {
                params: { walletAddress } // Pass the currently active Wagmi wallet
            });
            if (res.data.success) {
                setUpcomingPayments(res.data.data);
            }
        } catch (err) {
            console.error('[LenderDashboard] fetchUpcomingPayments error:', err);
        } finally {
            setUpcomingLoading(false);
        }
    };

    const fetchMyAds = async () => {
        if (!token && !userProfile?.token) return;
        setAdsLoading(true);
        try {
            const res = await api.get('/loans/lender/my-ads');
            if (res.data.success) {
                setMyAds(res.data.data);
            }
        } catch (err) {
            console.error('[LenderDashboard] fetchMyAds error:', err);
        } finally {
            setAdsLoading(false);
        }
    };

    const handlePostAd = async (e) => {
        e.preventDefault();
        if (!adAmount || !adMinInterest || !adMaxDuration) {
            return toast.error("Please fill all fields");
        }

        setPostingAd(true);
        const tid = toast.loading('Posting your lending offer to marketplace...');
        try {
            const res = await api.post('/loans/lender/ad', {
                amountAvailable: Number(adAmount),
                minInterestRate: Number(adMinInterest),
                maxDuration: Number(adMaxDuration),
                loanMode: Number(adLoanMode)
            });
            if (res.data.success) {
                toast.success('Offer posted! Watch for automatic matches.', { id: tid });
                setAdAmount('');
                setAdMinInterest('');
                setAdMaxDuration('');
                fetchMyAds();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to post offer", { id: tid });
        } finally {
            setPostingAd(false);
        }
    };

    const handleDeleteAd = async (adId) => {
        const tid = toast.loading('Deactivating offer...');
        try {
            const res = await api.delete(`/loans/lender/ad/${adId}`);
            if (res.data.success) {
                toast.success('Offer deactivated', { id: tid });
                fetchMyAds();
            }
        } catch (err) {
            toast.error("Failed to deactivate", { id: tid });
        }
    };

    const fetchBalance = async () => {
        if (!walletAddress || !addresses.mockUSDT) return;
        try {
            const provider = walletClient
                ? new ethers.BrowserProvider(walletClient.transport)
                : getSharedProvider();
            const contract = new ethers.Contract(addresses.mockUSDT, tUSDTAbi, provider);
            const bal = await contract.balanceOf(walletAddress);
            const decimals = await contract.decimals();
            setTUSDTBalance(Number(ethers.formatUnits(bal, decimals)).toFixed(2));
        } catch (error) {
            console.error("[LenderDashboard] Failed to fetch tUSDT balance:", error);
        }
    };

    const handleClaimFaucet = async () => {
        if (!walletClient) {
            toast.error('Connect your wallet first');
            return;
        }
        if (!addresses.mockUSDT) {
            toast.error('MockUSDT contract address not configured');
            return;
        }

        setClaimingFaucet(true);
        const tid = toast.loading('Preparing faucet claim...');
        try {
            const provider = new ethers.BrowserProvider(walletClient.transport);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(addresses.mockUSDT, tUSDTAbi, signer);

            // Get decimals then mint 1000 tokens
            const decimals = await contract.decimals();
            const amount = ethers.parseUnits('1000', decimals);

            toast.loading('Confirm in wallet...', { id: tid });
            const tx = await contract.mint(walletAddress, amount);

            toast.loading('Minting 1000 tUSDT on Sepolia...', { id: tid });
            await tx.wait();

            toast.success('1000 tUSDT minted to your wallet!', { id: tid });
            fetchBalance();
        } catch (err) {
            const msg = err?.reason || err?.message || 'Faucet mint failed';
            toast.error(msg.length > 80 ? 'Mint failed — check console' : msg, { id: tid });
            console.error('[Faucet] mint error:', err);
        } finally {
            setClaimingFaucet(false);
        }
    };


    useEffect(() => {
        if (walletAddress) {
            fetchLenderAgreements();
            fetchBalance();
            fetchUpcomingPayments();
            fetchMyAds();
        }
    }, [walletAddress, walletClient]);

    // Listen to Agreement Events (Lender View)
    useEffect(() => {
        if (!lenderAgreements.length || !walletClient) return;
        const provider = new ethers.BrowserProvider(walletClient.transport);
        const activeListeners = [];

        lenderAgreements.forEach(agr => {
            const contract = new ethers.Contract(agr.address, agreementAbi, provider);

            const onPaid = (_, installmentNumber, amountPaid) => {
                toast.success(`Installment #${installmentNumber} received!`);
                fetchLenderAgreements();
            };

            const onMissed = (_, cyclesMissed, paymentFailed) => {
                toast.error(`Borrower missed an installment! Penalty triggered.`);
                fetchLenderAgreements();
            };

            contract.on("InstallmentPaid", onPaid);
            contract.on("InstallmentMissed", onMissed);
            activeListeners.push({ contract, onPaid, onMissed });
        });

        return () => {
            activeListeners.forEach(({ contract, onPaid, onMissed }) => {
                contract.off("InstallmentPaid", onPaid);
                contract.off("InstallmentMissed", onMissed);
            });
        };
    }, [lenderAgreements.map(a => a.address).join(','), walletClient]);



    const fetchOnChainLoans = async () => {
        if (!walletAddress) return;
        setOnChainLoading(true);
        try {
            const provider = walletClient
                ? new ethers.BrowserProvider(walletClient.transport)
                : getSharedProvider();
            const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, provider);

            // Single call — getAllLoans(), filter client-side
            let rawLoans = [];
            try {
                rawLoans = await contract.getAllLoans();
                console.log("[LenderDashboard] getAllLoans() returned:", rawLoans.length, "loans");
            } catch {
                const count = await contract.loanCounter();
                for (let i = 1; i <= Number(count); i++) {
                    rawLoans.push(await contract.getLoanDetails(i));
                }
                console.log("[LenderDashboard] Fallback loop fetched:", rawLoans.length, "loans");
            }

            const allCreated = [];
            const allFunded = [];

            for (const loan of rawLoans) {
                const formattedLoan = {
                    id: Number(loan.id),
                    borrower: loan.borrower,
                    lender: loan.lender,
                    amount: ethers.formatEther(loan.amount),
                    interest: ethers.formatEther(loan.interest),
                    duration: Number(loan.duration),
                    funded: loan.funded,
                    repaid: loan.repaid
                };
                if (loan.borrower.toLowerCase() === walletAddress.toLowerCase()) {
                    allCreated.push(formattedLoan);
                }
                if (loan.lender.toLowerCase() !== ethers.ZeroAddress.toLowerCase() &&
                    loan.lender.toLowerCase() === walletAddress.toLowerCase()) {
                    allFunded.push(formattedLoan);
                }
            }

            console.log("[LenderDashboard] My created loans:", allCreated.length);
            console.log("[LenderDashboard] My funded loans:", allFunded.length);
            setOnChainLoans({ created: allCreated, funded: allFunded });
        } catch (error) {
            console.error("[LenderDashboard] Error fetching on-chain loans:", error);
        } finally {
            setOnChainLoading(false);
        }
    };

    const verifyIdentity = async () => {
        if (!walletAddress) {
            setIdentityChecking(false);
            return;
        }
        setIdentityChecking(true);
        try {
            const provider = walletClient
                ? new ethers.BrowserProvider(walletClient.transport)
                : null;
            const hasNFT = await checkIdentityOwnership(walletAddress, provider);
            setHasIdentity(hasNFT);
            // Removed fragile auto-redirect: if RPC fails, we just show the unverified warning
        } catch (err) {
            console.error('[LenderDashboard] verifyIdentity error:', err);
            setHasIdentity(false);
        } finally {
            setIdentityChecking(false);
        }
    };

    const fetchLoans = async () => {
        setLoading(true);

        // ── Structured diagnostics ─────────────────────────────────────────
        console.group('[Sync Protocol] Starting marketplace sync...');
        console.log(' Wallet address :', walletAddress || '(not connected)');
        console.log(' Chain ID :', chainId || '(unknown)');
        console.log(' Network :', chainId === 11155111 ? 'Sepolia ✅' : `Wrong network ⚠️ (chainId=${chainId})`);
        console.log(' Factory addr :', addresses.loanFactory || '(not set)');
        console.log(' TrustScore addr:', addresses.trustScore || '(not set)');

        try {
            // 1. Fetch pending loans from backend ─────────────────────────
            let res;
            try {
                res = await api.get('/loans');
                console.log(' Backend status :', res.status);
                console.log(' Loans count :', res.data?.count ?? 0);
            } catch (backendErr) {
                const isNetworkErr = !backendErr.response;
                const specificMsg = isNetworkErr
                    ? 'Backend offline — check VITE_API_URL and EC2 status'
                    : `Backend error ${backendErr.response?.status}: ${backendErr.response?.data?.message || backendErr.message}`;
                console.error(' [Sync] Backend request failed:', specificMsg, backendErr);
                toast.error(specificMsg);
                return;
            }

            if (!res.data?.success) {
                const msg = res.data?.message || 'Backend returned an unsuccessful response';
                console.error(' [Sync] Unsuccessful response body:', res.data);
                toast.error(msg);
                return;
            }

            const loanData = res.data.data ?? [];

            // 2. Safe: Try to enrich with on-chain trust score ────────────
            // Wrapped entirely so any RPC failure never kills the sync.
            let hasRegistry = false;
            let trustRegistry = null;

            try {
                const provider = getSharedProvider();
                const blockNum = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout')), 8000))
                ]);
                console.log(' RPC block num :', blockNum);

                if (addresses.trustScore) {
                    const code = await provider.getCode(addresses.trustScore).catch(() => '0x');
                    hasRegistry = (code !== '0x' && code !== '0x0');
                    console.log(' TrustScore code:', hasRegistry ? 'deployed ✅' : 'not deployed / empty ⚠️');

                    if (hasRegistry) {
                        trustRegistry = new ethers.Contract(addresses.trustScore, trustScoreAbi, provider);
                    }
                } else {
                    console.warn(' [Sync] trustScore address not set in addresses.json — skipping on-chain enrichment');
                }
            } catch (rpcErr) {
                console.warn(' [Sync] On-chain enrichment skipped (RPC issue):', rpcErr.message);
                // Non-fatal — continue with off-chain trust scores from DB
            }

            // 3. Enrich each loan (never throw) ───────────────────────────
            const enhancedLoans = await Promise.all(
                loanData.map(async (loan) => {
                    try {
                        if (hasRegistry && trustRegistry && loan.borrower?.walletAddress) {
                            const onChainScore = await trustRegistry.getTrustScore(loan.borrower.walletAddress);
                            return { ...loan, onChainTrustScore: Number(onChainScore) };
                        }
                    } catch (enrichErr) {
                        console.warn(' [Sync] Failed to fetch on-chain score for', loan.borrower?.walletAddress, enrichErr.message);
                    }
                    // Fall back to off-chain score stored in MongoDB
                    return { ...loan, onChainTrustScore: loan.borrower?.trustScore ?? 0 };
                })
            );

            console.log(' Enhanced loans :', enhancedLoans.length);
            console.groupEnd();

            setLoans(enhancedLoans); // empty array is valid — no error toast

        } catch (error) {
            // Catch-all: should rarely hit here now since each layer has its own guard
            const specificMsg = error?.response?.data?.message
                || error?.message
                || 'Unknown sync error';
            console.error('[Sync Protocol] Unhandled error:', specificMsg, error);
            console.groupEnd();
            toast.error(`Sync failed: ${specificMsg}`);
        } finally {
            setLoading(false);
        }
    };


    const handleFundLoan = async (loanId, smartContractId, borrowerWallet, amount, interestRate, durationMonths) => {
        if (!isConnected) return toast.error("Please connect wallet");

        const tid = toast.loading('Initiating protocol deployment...');
        setActionLoading(loanId);

        try {
            const hasIdentity = await checkIdentityOwnership(walletAddress);
            if (!hasIdentity) {
                toast.error("No identity NFT detected", { id: tid });
                navigate("/onboarding");
                return;
            }

            const provider = new ethers.BrowserProvider(walletClient.transport);
            const signer = await provider.getSigner();

            // Verify Microfinance contract code exists
            const code = await signer.provider.getCode(addresses.microfinance);
            if (code === "0x" || code === "0x0") {
                throw new Error("Loan Contract (Microfinance) not found at configured address on Sepolia.");
            }

            const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, signer);
            const principal = ethers.parseEther(amount.toString());

            if (!smartContractId) {
                throw new Error("Unable to fund: Request not found on protocol node.");
            }

            toast.loading('Confirm in wallet...', { id: tid });
            const tx = await contract.fundLoan(smartContractId, { value: principal });

            toast.loading('Mining transaction...', { id: tid });
            await tx.wait();

            toast.loading('Synchronizing state...', { id: tid });
            await api.put(`/loans/${loanId}/fund`, {
                lenderId: userProfile._id
            });

            toast.success('Capital deployed successfully!', { id: tid });
            fetchLoans();
        } catch (error) {
            toast.error(parseBlockchainError(error), { id: tid });
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 p-1">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Lender Marketplace</h1>
                    <p className="text-sm text-text-secondary mt-1">Deploy capital into verified peer-to-peer loans.</p>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">tUSDT Balance</span>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>{tUSDTBalance} tUSDT</span>
                            <button
                                onClick={handleClaimFaucet}
                                disabled={claimingFaucet}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
                            >
                                {claimingFaucet ? 'Claiming...' : 'Claim 1000 tUSDT'}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={fetchLoans}
                        className="btn-ghost flex items-center gap-2 !text-xs"
                    >
                        <FiSearch className={loading ? 'animate-spin' : ''} size={14} />
                        Sync
                    </button>
                </div>
            </header>

            {/* ── Identity Status Pill Bar ── */}
            <div className="flex flex-wrap items-center gap-3">
                {identityChecking ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                        <FiLoader size={12} className="text-text-secondary animate-spin" />
                        <span className="text-xs font-medium text-text-secondary">Verifying Identity...</span>
                    </div>
                ) : hasIdentity ? (
                    <>
                        <a href={`https://sepolia.etherscan.io/token/${addresses.identity}?a=${walletAddress}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-80" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                            <FiCheckCircle size={12} style={{ color: '#16A34A' }} />
                            <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>Verified SBT</span>
                        </a>
                        <a href={`https://sepolia.etherscan.io/address/${walletAddress}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-80" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                            <FiShield size={12} style={{ color: '#2563EB' }} />
                            <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>Authorized</span>
                        </a>
                    </>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                        <FiAlertCircle size={12} style={{ color: '#DC2626' }} />
                        <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>Identity Not Verified</span>
                    </div>
                )}
                {chainId && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                        <div className={`w-1.5 h-1.5 rounded-full ${chainId === 11155111 ? 'animate-pulse' : ''}`} style={{ backgroundColor: chainId === 11155111 ? '#16A34A' : '#DC2626' }} />
                        <span className="text-xs font-semibold" style={{ color: chainId === 11155111 ? '#16A34A' : '#DC2626' }}>{chainId === 11155111 ? 'Sepolia' : 'Wrong Network'}</span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="premium-card animate-pulse h-96 rounded-3xl border border-border"></div>
                    ))}
                </div>
            ) : loans.length === 0 ? (
                <div className="premium-card text-center py-20 space-y-6 border-2 border-dashed border-border">
                    <div className="w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto text-text-primary">
                        <FiInfo size={40} />
                    </div>
                    <p className="text-text-secondary0 font-bold italic text-lg">Market is synchronized. No active requests.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loans.map((loan) => (
                        <div key={loan._id} className="premium-card !p-6 flex flex-col justify-between" style={{ borderLeft: '4px solid #16A34A' }}>
                            <div>
                                <div className="flex justify-between items-start mb-5">
                                    <div>
                                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Capital Required</p>
                                        <p className="text-2xl md:text-3xl font-bold text-text-primary">{loan.amountRequested} <span className="text-sm font-normal text-text-secondary">{addresses.mockUSDT ? 'tUSDT' : 'ETH'}</span></p>
                                    </div>
                                    <span className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                                        {loan.interestRate}% APY
                                    </span>
                                </div>

                                <div className="space-y-3 mb-5">
                                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <div className="flex items-center gap-2">
                                            <FiTrendingUp size={14} style={{ color: '#2563EB' }} />
                                            <span className="text-xs font-semibold text-text-secondary">Trust Score</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-bold text-text-primary">{loan.onChainTrustScore}</span>
                                            <div className="flex gap-1.5">
                                                {loan.onChainTrustScore >= 300 && <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>Elite</span>}
                                                {loan.onChainTrustScore >= 100 && loan.onChainTrustScore < 300 && <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}>Verified</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                            <p className="text-xs font-semibold text-text-secondary mb-1">Interest</p>
                                            <p className="font-bold text-sm" style={{ color: '#16A34A' }}>+{(loan.amountRequested * (loan.interestRate / 100)).toFixed(3)}</p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                            <p className="text-xs font-semibold text-text-secondary mb-1">Term</p>
                                            <p className="font-bold text-sm" style={{ color: '#2563EB' }}>{loan.durationMonths}m</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl" style={{ border: '1px dashed #E2E8F0' }}>
                                        <p className="text-xs font-semibold text-text-secondary mb-2">Borrower Rationale</p>
                                        <p className="text-text-secondary text-xs line-clamp-2 leading-relaxed">"{loan.purpose}"</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 pt-6 border-t border-border">
                                <TransactionAccordion txHash={loan.simulatedSmartContractId ? `Protocol ID: ${loan.simulatedSmartContractId}` : null} />
                                <button
                                    onClick={() => handleFundLoan(loan._id, loan.simulatedSmartContractId, loan.borrower?.walletAddress, loan.amountRequested, loan.interestRate, loan.durationMonths)}
                                    disabled={actionLoading === loan._id}
                                    className="btn-primary w-full !py-4 text-xs font-bold uppercase tracking-wider"
                                >
                                    {actionLoading === loan._id ? <FiLoader className="animate-spin inline mr-2 text-white" /> : 'Deploy Capital'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* On-Chain Archive intentionally hidden from Lender view —
"Created by You" is always empty (lenders never create loans)
 and"Funded by You" duplicates the Funded Agreements section below. */}

            {/* ── Upcoming Receivables Section ── */}
            <section className="pt-8" style={{ borderTop: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-text-primary">Upcoming Receivables</h2>
                        <p className="text-sm text-text-secondary mt-1">Scheduled installments from borrowers across all active agreements.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {upcomingLoading && <FiLoader size={16} className="animate-spin" style={{ color: '#2563EB' }} />}
                        <span className="badge">{upcomingPayments.length} Active</span>
                    </div>
                </div>

                {upcomingPayments.length === 0 && !upcomingLoading ? (
                    <div className="premium-card py-14 text-center space-y-4 border-2 border-dashed border-border">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-text-primary">
                            <FiClock size={28} />
                        </div>
                        <p className="text-text-secondary0 font-bold italic">No upcoming payments.</p>
                        <p className="text-text-primary text-sm font-medium">Fund a loan request on the marketplace to start earning installments.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {upcomingPayments.map((payment) => {
                            const dueDate = payment.nextDueDate > 0
                                ? new Date(payment.nextDueDate * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—';
                            const daysUntil = payment.nextDueDate > 0
                                ? Math.ceil((payment.nextDueDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
                                : null;
                            const isOverdue = payment.isOverdue || (daysUntil !== null && daysUntil < 0);

                            return (
                                <div key={payment.loanId} className="premium-card !p-5"
                                    style={{ borderLeft: `4px solid ${isOverdue ? '#DC2626' : daysUntil !== null && daysUntil <= 3 ? '#D97706' : '#16A34A'}` }}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Installment</p>
                                            <p className="text-xl font-bold text-text-primary">{Number(payment.installmentAmount).toFixed(4)} <span className="text-text-secondary text-sm font-normal">{payment.loanMode}</span></p>
                                        </div>
                                        {isOverdue ? (
                                            <span className="badge-danger">Overdue</span>
                                        ) : daysUntil !== null && daysUntil <= 3 ? (
                                            <span className="badge-warning">Due Soon</span>
                                        ) : (
                                            <span className="badge-success">Scheduled</span>
                                        )}
                                    </div>

                                    {/* Details grid */}
                                    <div className="grid grid-cols-2 gap-3 rounded-xl p-3 mb-4 border border-border">
                                        <div>
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider mb-1">Next Due</p>
                                            <p className="text-sm font-bold text-text-primary">{dueDate}</p>
                                            {daysUntil !== null && (
                                                <p className={`text-[10px] font-semibold mt-0.5 ${isOverdue ? 'text-red-600' : daysUntil <= 3 ? 'text-amber-600' : 'text-text-secondary'
                                                    }`}>
                                                    {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : `in ${daysUntil}d`}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[8px] text-text-secondary0 font-black uppercase tracking-widest mb-1">Borrower</p>
                                            <p className="text-xs font-mono text-text-secondary">
                                                {payment.borrowerAddress
                                                    ? `${payment.borrowerAddress.slice(0, 6)}...${payment.borrowerAddress.slice(-4)}`
                                                    : '—'
                                                }
                                            </p>
                                            <p className="text-[9px] text-text-primary font-bold mt-0.5">{payment.remainingPayments} left</p>
                                        </div>
                                    </div>

                                    {/* Mode tag: Autopay or Manual */}
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${payment.autopay
                                        ? 'bg-blue-50 border border-blue-100 text-blue-700'
                                        : 'bg-slate-50 border border-slate-100 text-slate-600'
                                        }`}>
                                        <FiZap size={12} className={payment.autopay ? 'text-blue-500' : 'text-slate-400'} />
                                        {payment.autopay ? 'Autopay Enabled' : 'Manual Repayment'}
                                        {payment.missedPayments > 0 && (
                                            <span className="ml-auto text-[10px] text-red-600 font-bold">{payment.missedPayments} missed</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── Factory Funded Agreements (Lender view) ── */}
            {addresses.loanFactory && lenderAgreements.length > 0 && (
                <section className="pt-8" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-text-primary">Funded Agreements</h2>
                            <p className="text-sm text-text-secondary mt-1">P2P loan contracts you've funded — track installment returns.</p>
                        </div>
                        {lenderAgreementsLoading && <FiLoader size={16} className="animate-spin" style={{ color: '#2563EB' }} />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {lenderAgreements.map(agr => {
                            const paidSoFar = (agr.paymentsMade * Number(agr.monthlyPayment)).toFixed(6);
                            const totalExpected = (agr.totalDuration * Number(agr.monthlyPayment)).toFixed(6);
                            const progress = agr.totalDuration > 0 ? (agr.paymentsMade / agr.totalDuration) * 100 : 0;
                            return (
                                <div key={agr.address} className="premium-card !p-6" style={{ borderLeft: `4px solid ${agr.completed ? '#16A34A' : agr.isOverdue ? '#DC2626' : '#2563EB'}` }}>
                                    <div className="flex justify-between items-start mb-5">
                                        <div>
                                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Agreement</p>
                                            <p className="text-xs font-mono text-text-secondary">{agr.address.slice(0, 10)}...{agr.address.slice(-6)}</p>
                                        </div>
                                        <span className={agr.completed ? 'badge-success' : 'badge'}>
                                            {agr.completed ? 'Completed' : 'Active'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        <div className="rounded-xl p-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                            <p className="text-xs font-semibold text-text-secondary mb-1">Received So Far</p>
                                            <p className="font-bold" style={{ color: '#16A34A' }}>{paidSoFar} <span className="text-text-secondary text-xs font-normal">{agr.mode === 0 ? 'ETH' : 'tUSDT'}</span></p>
                                        </div>
                                        <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                            <p className="text-xs font-semibold text-text-secondary mb-1">Total Expected</p>
                                            <p className="font-bold text-text-primary">{totalExpected} <span className="text-text-secondary text-xs font-normal">{agr.mode === 0 ? 'ETH' : 'tUSDT'}</span></p>
                                        </div>
                                    </div>

                                    {/* Configuration Details */}
                                    <div className="grid grid-cols-2 gap-4 mb-6 rounded-xl p-4 border border-border">
                                        <div>
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider mb-1">Currency Mode</p>
                                            <p className="text-sm font-bold text-text-primary uppercase tracking-tight">{agr.mode === 0 ? 'Ethereum Base' : 'ERC20 (tUSDT)'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider mb-1">Autopay Execution</p>
                                            {agr.mode === 1 ? (
                                                <span className="text-sm font-bold text-brand-accent uppercase flex items-center justify-end gap-1.5"><FiCheckCircle size={14} /> Enabled</span>
                                            ) : (
                                                <span className="text-sm font-bold text-text-secondary uppercase flex items-center justify-end gap-1.5">Disabled</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 mb-6 rounded-xl p-3 text-center bg-slate-50 border border-slate-100">
                                        <div>
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Received</p>
                                            <p className="text-text-primary font-bold">{agr.paymentsMade}/{agr.totalDuration}</p>
                                        </div>
                                        <div className="border-x border-slate-200">
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Monthly</p>
                                            <p className="text-brand-accent font-bold text-xs">{agr.monthlyPayment} {agr.mode === 0 ? 'ETH' : 'tUSDT'}</p>
                                        </div>
                                        <div className="border-r border-slate-200">
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Remaining</p>
                                            <p className="text-brand-accent font-bold">{agr.remainingPayments}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Missed</p>
                                            <p className="text-brand-accent font-bold">{agr.missedPayments}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-semibold text-text-secondary">Collection Progress</p>
                                            <p className="text-xs font-semibold text-text-secondary">{progress.toFixed(0)}%</p>
                                        </div>
                                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: '#2563EB' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
};

export default LenderDashboard;
