import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { ethers } from 'ethers';
import { useAccount, useConfig, useWalletClient } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiLoader, FiCheckCircle, FiInfo, FiActivity, FiShield, FiPlus, FiCalendar, FiTrendingUp, FiAlertCircle, FiChevronDown, FiChevronUp, FiAward } from 'react-icons/fi';


import addresses from '../contracts/addresses.json';
import _microfinanceJson from '../contracts/Microfinance.json';
// Support both { abi: [...] } wrapped format and raw array format
const microfinanceAbi = Array.isArray(_microfinanceJson) ? _microfinanceJson : _microfinanceJson.abi;
import _factoryJson from '../contracts/LoanAgreementFactory.json';
import _agreementJson from '../contracts/LoanAgreement.json';
const factoryAbi = Array.isArray(_factoryJson) ? _factoryJson : _factoryJson.abi;
const agreementAbi = Array.isArray(_agreementJson) ? _agreementJson : _agreementJson.abi;
import { mintIdentity, checkIdentityOwnership, parseBlockchainError, getSharedProvider } from '../blockchainService';
import LoanTimeline from '../components/LoanTimeline';
import TransactionAccordion from '../components/TransactionAccordion';


const BorrowerDashboard = () => {
    const { userProfile, token } = useAuth();
    const { address: walletAddress, isConnected, chainId } = useAccount();
    const config = useConfig();
    const { data: walletClient } = useWalletClient();
    const navigate = useNavigate();

    const [amount, setAmount] = useState('');
    const [duration, setDuration] = useState('');
    const [purpose, setPurpose] = useState('');
    const [loading, setLoading] = useState(false);
    const [myLoans, setMyLoans] = useState([]);
    const [processingLoan, setProcessingLoan] = useState(null);
    const [onChainLoans, setOnChainLoans] = useState({ created: [], funded: [] });
    const [onChainLoading, setOnChainLoading] = useState(false);
    const [hasIdentity, setHasIdentity] = useState(false);
    const [identityChecking, setIdentityChecking] = useState(true);
    const [contractLinkInfo, setContractLinkInfo] = useState({ identity: 'Checking...', trust: 'Checking...' });

    // Factory agreements
    const [agreements, setAgreements] = useState([]);
    const [agreementsLoading, setAgreementsLoading] = useState(false);
    const [payingInstallment, setPayingInstallment] = useState(null);
    const [myAds, setMyAds] = useState([]);
    const [myAdsLoading, setMyAdsLoading] = useState(false);

    // Trust score data (from backend /me endpoint)
    const [trustData, setTrustData] = useState({
        trustScore: userProfile?.trustScore ?? 300,
        completedLoans: userProfile?.completedLoans ?? 0,
        trustHistory: []
    });
    const [showTrustHistory, setShowTrustHistory] = useState(false);

    const getTrustTier = (score) => {
        if (score >= 850) return { label: 'Prime', };
        if (score >= 700) return { label: 'Trusted', };
        if (score >= 500) return { label: 'Building Credit', };
        return { label: 'New Borrower', };
    };

    const fetchTrustData = async () => {
        if (!token && !userProfile?.token) return;
        try {
            const res = await api.get('/users/me');
            if (res.data.success) {
                setTrustData({
                    trustScore: res.data.data.trustScore ?? 300,
                    completedLoans: res.data.data.completedLoans ?? 0,
                    trustHistory: res.data.data.trustHistory ?? [],
                });
            }
        } catch (err) {
            console.error('[BorrowerDashboard] Failed to fetch trust data:', err.message);
        }
    };


    const checkContractSync = async () => {
        try {
            const provider = walletClient ? new ethers.BrowserProvider(walletClient.transport) : getSharedProvider();

            // 1. Verify code exists at the address
            const code = await provider.getCode(addresses.microfinance);
            if (code === '0x' || code === '0x0') {
                console.error("[Diagnostic] NO CONTRACT CODE FOUND at", addresses.microfinance);
                setContractLinkInfo({ identity: 'UNRESOLVED ADDR', trust: 'MISSING CODE' });
                return;
            }

            const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, provider);

            // 2. Read identityContract address via getIdentityAddress() debug function
            let identityAddr;
            try {
                identityAddr = await contract.getIdentityAddress();
            } catch {
                // Fallback: try old public variable name
                try { identityAddr = await contract.identityContract(); } catch { identityAddr = await contract.identity(); }
            }
            const trustAddr = await contract.trustScore();

            setContractLinkInfo({
                identity: identityAddr,
                trust: trustAddr
            });

            // Step 10: Log identity address so we can verify wiring
            console.log("Microfinance identity address:", identityAddr);
            console.log("Config identity address :", addresses.identity);
            console.log(
                identityAddr?.toLowerCase() === addresses.identity?.toLowerCase()
                    ? "[Diagnostic] ✅ Identity wiring MATCH — contract in sync."
                    : "[Diagnostic] 🚨 MISMATCH — Microfinance is pointing to wrong Identity!"
            );
        } catch (err) {
            console.error("[Diagnostic] Contract sync check failed:", err);
            const msg = err.message?.includes('call revert exception') ? 'REVERTED ON READ' :
                err.message?.includes('network') ? 'NETWORK ERROR' : 'ERROR: ' + err.message?.slice(0, 15);
            setContractLinkInfo({ identity: msg, trust: 'Error' });
        }
    };

    useEffect(() => {
        if (walletAddress) {
            checkUserIdentity();
            fetchOnChainLoans();
            fetchMyLoans();
            fetchMyAds();
            checkContractSync();
            fetchTrustData();
        }

        // Event listeners for real-time updates
        const provider = getSharedProvider();
        const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, provider);

        const handleUpdate = () => {
            fetchOnChainLoans();
            fetchMyLoans();
        };

        contract.on("LoanCreated", handleUpdate);
        contract.on("LoanFunded", handleUpdate);
        contract.on("LoanRepaid", handleUpdate);

        // Factory Listeners
        const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, provider);
        const handleFactoryUpdate = () => {
            fetchMyAds();
            fetchAgreements();
            fetchMyLoans();
        };
        factory.on("LoanRequested", handleFactoryUpdate);
        factory.on("LoanFunded", handleFactoryUpdate);

        return () => {
            contract.off("LoanCreated", handleUpdate);
            contract.off("LoanFunded", handleUpdate);
            contract.off("LoanRepaid", handleUpdate);
            factory.off("LoanRequested", handleFactoryUpdate);
            factory.off("LoanFunded", handleFactoryUpdate);
        };
    }, [walletAddress]);

    // ──────────────────────────────────────────────────────
    // Fetch LoanAgreementFactory agreements for this borrower
    // ──────────────────────────────────────────────────────
    const fetchAgreements = async () => {
        if (!walletAddress || !addresses.loanFactory) return;
        setAgreementsLoading(true);
        try {
            const provider = walletClient
                ? new ethers.BrowserProvider(walletClient.transport)
                : getSharedProvider();

            const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, provider);
            const addrs = await factory.getBorrowerAgreements(walletAddress);
            console.log('[BorrowerDashboard] factory agreements:', addrs.length);

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
                        isDue: Date.now() / 1000 >= Number(status._nextDueTimestamp),
                        allowance: mode === 1 ? ethers.formatUnits(await new ethers.Contract(addresses.mockUSDT, ["function allowance(address,address) view returns (uint256)"], provider).allowance(walletAddress, addr), 6) : 0
                    };
                } catch (e) {
                    console.error('[BorrowerDashboard] Failed to read agreement:', addr, e);
                    return null;
                }
            }));

            setAgreements(details.filter(Boolean));
        } catch (err) {
            console.error('[BorrowerDashboard] fetchAgreements error:', err);
        } finally {
            setAgreementsLoading(false);
        }
    };

    useEffect(() => {
        if (walletAddress) fetchAgreements();
    }, [walletAddress, walletClient]);

    // Listen to Agreement Events
    useEffect(() => {
        if (!agreements.length || !walletClient) return;
        const provider = new ethers.BrowserProvider(walletClient.transport);
        const activeListeners = [];

        agreements.forEach(agr => {
            const contract = new ethers.Contract(agr.address, agreementAbi, provider);

            const onPaid = (borrower, installmentNumber, amountPaid) => {
                if (borrower.toLowerCase() === walletAddress.toLowerCase()) {
                    toast.success(`Installment #${installmentNumber} paid!`, { id: `paid-${installmentNumber}` });
                    fetchAgreements();
                    fetchMyLoans();
                    fetchTrustData();
                }
            };

            const onMissed = (borrower, cyclesMissed, paymentFailed) => {
                if (borrower.toLowerCase() === walletAddress.toLowerCase()) {
                    toast.error(`Installment missed! Triggers penalty.`, { id: `missed-${cyclesMissed}` });
                    fetchAgreements();
                    fetchMyLoans();
                    fetchTrustData();
                }
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
    }, [agreements.map(a => a.address).join(','), walletClient, walletAddress]);

    const handlePayInstallment = async (agreement) => {
        if (!isConnected || !walletClient) return toast.error('Connect wallet first');
        const tid = toast.loading(`Paying installment for ${agreement.address.slice(0, 8)}...`);
        setPayingInstallment(agreement.address);
        try {
            const provider = new ethers.BrowserProvider(walletClient.transport);
            const signer = await provider.getSigner();

            // Branch based on loan mode
            let tx;
            if (agreement.mode === 0) {
                // ETH mode: send native ETH via repayETH()
                const agr = new ethers.Contract(agreement.address, agreementAbi, signer);
                const valueUnits = ethers.parseEther(agreement.monthlyPayment.toString()); // ETH has 18 decimals
                toast.loading('Confirm ETH payment in wallet...', { id: tid });
                tx = await agr.repayETH({ value: valueUnits });
            } else {
                // ERC20 mode: approve tUSDT then call repayInstallment()
                const tokenAbi = ["function approve(address spender, uint256 amount) public returns (bool)", "function allowance(address owner, address spender) view returns (uint256)"];
                const usdt = new ethers.Contract(addresses.mockUSDT, tokenAbi, signer);
                const valueUnits = ethers.parseUnits(agreement.monthlyPayment.toString(), 6); // MockUSDT has 6

                const currentAllowance = await usdt.allowance(walletAddress, agreement.address);
                if (currentAllowance < valueUnits) {
                    toast.loading('Approving tUSDT for payment...', { id: tid });
                    const approvetx = await usdt.approve(agreement.address, valueUnits);
                    await approvetx.wait();
                }

                const agr = new ethers.Contract(agreement.address, agreementAbi, signer);
                toast.loading('Confirm token payment in wallet...', { id: tid });
                tx = await agr.repayInstallment();
            }

            toast.loading('Broadcasting...', { id: tid });
            await tx.wait();

            toast.success('Installment paid! Lender credited.', { id: tid });
            fetchAgreements();
        } catch (err) {
            toast.error(parseBlockchainError(err), { id: tid });
        } finally {
            setPayingInstallment(null);
        }
    };

    const handleApproveAutopay = async (agreement) => {
        if (!isConnected) return toast.error('Connect wallet first');
        if (!window.ethereum) return toast.error('MetaMask not found');

        const tid = toast.loading(`Approving Autopay for ${agreement.address.slice(0, 8)}...`);
        try {
            // Use window.ethereum directly to avoid MetaMask ERC20 rendering crash
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const signerAddress = await signer.getAddress();

            // Safety check: ensure current wallet is the actual borrower
            if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                toast.error(`Wallet Mismatch! Please switch to ${walletAddress.slice(0, 6)}...`, { id: tid });
                return;
            }

            const tokenAbi = ["function approve(address spender, uint256 amount) public returns (bool)"];
            const usdt = new ethers.Contract(addresses.mockUSDT, tokenAbi, signer);

            // Approve 1,000,000 tUSDT to the LoanAgreement contract (not the factory)
            // This allows repayInstallment() to call transferFrom(borrower, lender, amount)
            const largeApprovalUnits = ethers.parseUnits("1000000", 6);

            toast.loading(`Approving 1M tUSDT to agreement ${agreement.address.slice(0, 8)}...`, { id: tid });
            const tx = await usdt.approve(agreement.address, largeApprovalUnits);
            toast.loading('Waiting for confirmation on Sepolia...', { id: tid });
            await tx.wait();

            toast.success('Autopay Approved! Backend will process next installment within 60 seconds.', { id: tid });
            fetchAgreements();
        } catch (err) {
            toast.error(parseBlockchainError(err), { id: tid });
        }
    };


    const checkUserIdentity = async () => {
        setIdentityChecking(true);
        try {
            let provider = null;
            if (walletClient) {
                provider = new ethers.BrowserProvider(walletClient.transport);
            }
            const status = await checkIdentityOwnership(walletAddress, provider);
            setHasIdentity(status);

            // If user's KYC status is Verified/FaceVerified, treat them as identity-ready
            if (userProfile?.kycStatus === 'Verified' || userProfile?.kycStatus === 'FaceVerified') {
                setHasIdentity(true);
            }
        } catch (err) {
            console.error("Identity check error:", err);
        } finally {
            setIdentityChecking(false);
        }
    };

    const fetchOnChainLoans = async () => {
        if (!walletAddress) return;
        setOnChainLoading(true);
        try {
            const provider = walletClient
                ? new ethers.BrowserProvider(walletClient.transport)
                : getSharedProvider();
            const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, provider);

            // Use getAllLoans() — single call, then filter client-side
            let rawLoans = [];
            try {
                rawLoans = await contract.getAllLoans();
                console.log("[BorrowerDashboard] getAllLoans() returned:", rawLoans.length, "loans");
            } catch {
                // Fallback to loop if old ABI cached
                const count = await contract.loanCounter();
                for (let i = 1; i <= Number(count); i++) {
                    rawLoans.push(await contract.getLoanDetails(i));
                }
                console.log("[BorrowerDashboard] Fallback loop fetched:", rawLoans.length, "loans");
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

            console.log("[BorrowerDashboard] My created loans:", allCreated.length);
            console.log("[BorrowerDashboard] My funded loans:", allFunded.length);
            setOnChainLoans({ created: allCreated, funded: allFunded });
        } catch (error) {
            console.error("[BorrowerDashboard] Error fetching on-chain loans:", error);
        } finally {
            setOnChainLoading(false);
        }
    };

    const fetchMyLoans = async () => {
        try {
            const res = await api.get('/loans/my');
            if (res.data.success) {
                setMyLoans(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching my loans:", error);
        }
    };

    const fetchMyAds = async () => {
        if (!token && !userProfile?.token) return;
        setMyAdsLoading(true);
        try {
            const res = await api.get('/loans/my-ads');
            if (res.data.success) {
                setMyAds(res.data.data);
            }
        } catch (error) {
            console.error('[BorrowerDashboard] Error fetching my ads:', error);
        } finally {
            setMyAdsLoading(false);
        }
    };

    const handleRepayLoan = async (loanId, smartContractId, amount) => {
        if (!isConnected) return toast.error("Please connect your wallet");

        const tid = toast.loading('Initiating repayment on-chain...');
        setProcessingLoan(loanId);

        try {
            const hasIdentity = await checkIdentityOwnership(walletAddress);
            if (!hasIdentity) {
                toast.error("Protocol Access Denied: No Identity NFT", { id: tid });
                navigate("/onboarding");
                return;
            }

            const provider = new ethers.BrowserProvider(walletClient.transport);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, signer);

            const loanDetails = await contract.getLoanDetails(smartContractId);
            const valueToSend = loanDetails.amount + loanDetails.interest;

            toast.loading('Confirm repayment in wallet...', { id: tid });
            const tx = await contract.repayLoan(smartContractId, { value: valueToSend });

            toast.loading('Repayment pending on-chain...', { id: tid });
            await tx.wait();

            toast.loading('Finalizing with protocol...', { id: tid });
            await api.put(`/loans/${loanId}/repay`, {
                txHash: tx.hash
            });

            toast.success('Loan fully repaid! Reputation increased.', { id: tid });
            fetchMyLoans();
        } catch (error) {
            toast.error(parseBlockchainError(error), { id: tid });
        } finally {
            setProcessingLoan(null);
        }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        if (!isConnected) return toast.error("Please connect your wallet");

        const tid = toast.loading('Initializing proposal...');
        setLoading(true);

        try {
            const provider = new ethers.BrowserProvider(walletClient.transport);
            const hasIdentity = await checkIdentityOwnership(walletAddress, provider);
            if (!hasIdentity) {
                toast.error("No identity NFT detected", { id: tid });
                navigate("/onboarding");
                return;
            }

            const signer = await provider.getSigner();

            // Verify Microfinance contract code exists
            const code = await signer.provider.getCode(addresses.microfinance);
            if (code === "0x" || code === "0x0") {
                throw new Error("Loan Contract (Microfinance) not found at configured address on Sepolia.");
            }

            const contract = new ethers.Contract(addresses.microfinance, microfinanceAbi, signer);

            const principal = ethers.parseEther(amount.toString());
            const interest = ethers.parseEther((amount * 0.1).toString()); // 10% interest
            const durationInSeconds = Number(duration) * 30 * 24 * 60 * 60;

            toast.loading('Confirm transaction in wallet...', { id: tid });
            const tx = await contract.createLoan(principal, interest, durationInSeconds);

            toast.loading('Broadcasting to network...', { id: tid });
            await tx.wait();

            toast.loading('Syncing proposal state...', { id: tid });
            await api.post('/loans', {
                borrowerId: userProfile._id,
                amountRequested: Number(amount),
                interestRate: 10,
                durationMonths: Number(duration),
                purpose,
                txHash: tx.hash
            });

            toast.success('Proposal live in marketplace!', { id: tid });
            setAmount('');
            setDuration('');
            setPurpose('');
            fetchMyLoans();
            fetchMyAds();
        } catch (error) {
            console.error("[Protocol Error] Request failed:", error);
            toast.error(parseBlockchainError(error), { id: tid });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 p-1">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Borrower Dashboard</h1>
                    <p className="text-sm text-text-secondary mt-1">Manage your active loan obligations and protocol reputation.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { fetchAgreements(); fetchMyLoans(); checkUserIdentity(); fetchTrustData(); }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-border hover:bg-slate-50 transition-colors text-xs font-semibold text-text-secondary"
                    >
                        <FiActivity size={14} className={agreementsLoading ? 'animate-spin' : ''} />
                        Sync Dashboard
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#2563EB' }}></div>
                        <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>Live Sync</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
                {/* Left Column: Metrics & Form */}
                <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
                        {/* ── Protocol Reputation Card ── */}
                        <div className="premium-card card-blue">
                            <div className="flex items-center gap-2 mb-4">
                                <FiAward size={16} style={{ color: '#2563EB' }} />
                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Trust Score</span>
                            </div>
                            <div className="text-4xl md:text-5xl font-bold text-text-primary mb-2" style={{ color: '#2563EB' }}>{trustData.trustScore}</div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs font-semibold text-text-secondary">{getTrustTier(trustData.trustScore).label}</span>
                            </div>
                            {trustData.trustScore < 700 && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs text-text-secondary font-medium mb-1">
                                        <span>ETH unlock progress</span>
                                        <span>{trustData.trustScore} / 700</span>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#DBEAFE' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${Math.min(100, ((trustData.trustScore - 300) / 400) * 100)}%`, backgroundColor: '#2563EB' }}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="mt-4 pt-4 flex justify-between items-center" style={{ borderTop: '1px solid #BFDBFE' }}>
                                <span className="text-xs text-text-secondary font-medium">Completed Loans</span>
                                <span className="text-lg font-bold text-text-primary">{trustData.completedLoans}</span>
                            </div>
                        </div>

                        <div className={`premium-card !p-6`} style={{ borderLeft: `4px solid ${hasIdentity ? '#16A34A' : '#DC2626'}` }}>
                            <div className="flex items-center gap-2 mb-4">
                                <FiShield size={16} style={{ color: hasIdentity ? '#16A34A' : '#DC2626' }} />
                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Identity Status</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: hasIdentity ? '#F0FDF4' : '#FEF2F2' }}>
                                    {identityChecking ? <FiLoader className="animate-spin" style={{ color: '#2563EB' }} /> : hasIdentity ? <FiCheckCircle size={22} style={{ color: '#16A34A' }} /> : <FiInfo size={22} style={{ color: '#DC2626' }} />}
                                </div>
                                <div>
                                    <p className="text-base font-semibold text-text-primary">
                                        {identityChecking ? 'Checking...' : hasIdentity ? 'Verified SBT' : 'Not Verified'}
                                    </p>
                                    <p className="text-xs text-text-secondary">{hasIdentity ? 'Protocol Authorized' : 'Identity Missing'}</p>
                                </div>
                            </div>
                            {!hasIdentity && !identityChecking && (
                                <button onClick={checkUserIdentity} className="mt-4 w-full py-2 text-xs font-semibold rounded-lg transition-all" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                    Retry Verification
                                </button>
                            )}
                        </div>

                        <div className="premium-card !p-6 border-dashed border-slate-200 bg-slate-50/50">
                            <div className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <FiActivity className="text-blue-500" /> Protocol Health
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 font-semibold uppercase tracking-tight">Network</span>
                                    <span className="font-bold text-slate-700">{chainId === 11155111 ? 'Sepolia' : 'Wrong Network'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 font-semibold uppercase tracking-tight">Identity Node</span>
                                    <span className="font-mono text-slate-600">{addresses.identity.slice(0, 6)}...{addresses.identity.slice(-4)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 font-semibold uppercase tracking-tight">Linked Identity</span>
                                    {(() => {
                                        const val = contractLinkInfo.identity;
                                        const isAddr = val && val.startsWith('0x') && val.length === 42;
                                        const isMatch = isAddr && val.toLowerCase() === addresses.identity?.toLowerCase();
                                        return (
                                            <span className={`font-mono ${val === 'Checking...' ? 'text-slate-400' :
                                                !isAddr ? 'text-red-500' :
                                                    isMatch ? 'text-emerald-500' : 'text-amber-500'
                                                } font-bold`}>
                                                {val === 'Checking...' ? '...' :
                                                    isAddr ? `${val.slice(0, 6)}...${val.slice(-4)}` :
                                                        val.slice(0, 14)}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Loan List */}
                <div className="lg:col-span-2 space-y-5 order-1 lg:order-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold text-text-primary">Active Loans</h2>
                        <span className="badge">{myLoans.length} Records</span>
                    </div>

                    {myLoans.length === 0 ? (
                        <div className="premium-card py-20 text-center space-y-6 border-2 border-dashed border-border">
                            <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto text-text-primary">
                                <FiInfo size={40} />
                            </div>
                            <p className="text-text-secondary0 font-bold italic text-lg">No active protocol history detected.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 md:space-y-8">
                            {myLoans.map(loan => (
                                <div key={loan._id} className="premium-card !p-6 md:!p-8" style={{ borderLeft: '4px solid #2563EB' }}>
                                    <div className="flex flex-col sm:flex-row justify-between gap-5 mb-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-text-secondary">#{loan.simulatedSmartContractId || 'PENDING'}</span>
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${loan.status === 'Funded' ? 'badge-success' : loan.status === 'Repaid' ? 'badge-success' : 'badge'}`}>{loan.status}</span>
                                            </div>
                                            <p className="text-2xl md:text-3xl font-bold text-text-primary">{loan.amountRequested} <span className="text-text-secondary text-sm font-normal">ETH</span></p>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div>
                                                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Interest</p>
                                                <p className="text-text-primary font-bold text-lg">{loan.interestRate}%</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Term</p>
                                                <p className="text-text-primary font-bold text-lg">{loan.durationMonths}m</p>
                                            </div>
                                            <div className="pl-5" style={{ borderLeft: '1px solid #E2E8F0' }}>
                                                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Total Repay</p>
                                                <p className="font-bold text-lg" style={{ color: '#2563EB' }}>{(loan.amountRequested * (1 + loan.interestRate / 100)).toFixed(4)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-10 px-2 overflow-x-auto no-scrollbar">
                                        <div className="min-w-[400px]">
                                            <LoanTimeline status={loan.status} />
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-5" style={{ borderTop: '1px solid #E2E8F0' }}>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Blockchain Evidence</p>
                                            <TransactionAccordion txHash={loan.status === 'Funded' ? loan.fundingTxHash : loan.repaymentTxHash} />
                                        </div>

                                        {loan.status === 'Funded' && (
                                            <div className="flex flex-col gap-3">
                                                {(() => {
                                                    const agr = agreements.find(a => a.address.toLowerCase() === loan.simulatedSmartContractId?.toLowerCase());
                                                    if (agr && agr.mode === 1 && Number(agr.allowance) < Number(agr.monthlyPayment)) {
                                                        return (
                                                            <button
                                                                onClick={() => handleApproveAutopay(agr)}
                                                                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg transition-all animate-bounce"
                                                            >
                                                                <FiShield size={18} /> Approve Autopay
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <button
                                                    onClick={() => handleRepayLoan(loan._id, loan.simulatedSmartContractId, loan.amountRequested)}
                                                    disabled={processingLoan === loan._id}
                                                    className="btn-primary whitespace-nowrap !px-8 !py-3"
                                                >
                                                    {processingLoan === loan._id ? <FiLoader className="animate-spin" size={16} /> : 'Settle On-Chain'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── My Posted Loan Requests (Factory Ads) ── */}
            <section className="pt-8" style={{ borderTop: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-text-primary">My Posted Loan Requests</h2>
                        <p className="text-sm text-text-secondary mt-1">All ads you have broadcast on-chain to the lender marketplace.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {myAdsLoading && <FiLoader size={16} className="animate-spin" style={{ color: '#2563EB' }} />}
                        <span className="badge">{myAds.length} Ad{myAds.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {myAds.length === 0 && !myAdsLoading ? (
                    <div className="premium-card py-16 text-center space-y-4 border-2 border-dashed border-border">
                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-text-primary">
                            <FiAlertCircle size={32} />
                        </div>
                        <p className="text-text-secondary0 font-bold italic">You have not posted any loan requests yet.</p>
                        <p className="text-text-primary text-sm font-medium">Head to the <strong className="text-text-secondary">Borrow</strong> page to post your first loan request.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myAds.map(ad => (
                            <div key={ad.adId} className={`premium-card !p-6 border-l-4 transition-all duration-300 hover:shadow-md ${ad.status === 'Funded' ? 'border-l-emerald-500' : 'border-l-blue-500'}`}>
                                {/* Ad ID + Status pill */}
                                <div className="flex justify-between items-start mb-5">
                                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Ad #{ad.adId}</span>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${ad.status === 'Funded'
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                        }`}>
                                        {ad.status}
                                    </span>
                                </div>

                                {/* Principal */}
                                <div className="mb-5">
                                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mb-1">Principal</p>
                                    <p className="text-3xl font-bold text-text-primary tracking-tight">
                                        {Number(ad.principal).toFixed(2)}
                                        <span className="text-text-secondary text-sm font-medium ml-2">{ad.loanMode}</span>
                                    </p>
                                </div>

                                {/* Details grid */}
                                <div className="grid grid-cols-2 gap-3 rounded-xl p-3 mb-5 bg-slate-50 border border-slate-100">
                                    <div>
                                        <p className="text-[9px] text-text-secondary font-bold uppercase tracking-widest mb-1 text-center">Total Repay</p>
                                        <p className="text-sm font-bold text-text-primary text-center">{Number(ad.totalRepayment).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-text-secondary font-bold uppercase tracking-widest mb-1 text-center">Duration</p>
                                        <p className="text-sm font-bold text-text-primary text-center">{ad.repaymentInterval}m</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* On-Chain Archive Section */}
            <section className="pt-8" style={{ borderTop: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-text-primary">On-Chain Archive</h2>
                        <p className="text-sm text-text-secondary mt-1">Direct cryptographic verification of your protocol interactions.</p>
                    </div>
                    {onChainLoading && <FiLoader size={16} className="animate-spin" style={{ color: '#2563EB' }} />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Created Loans */}
                    <div className="space-y-6">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 px-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Created Requests
                        </h3>
                        {onChainLoans.created.length === 0 ? (
                            <div className="premium-card !p-10 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-slate-100 bg-transparent">Zero Records Found</div>
                        ) : (
                            onChainLoans.created.map(loan => (
                                <div key={loan.id} className="premium-card !p-6 flex flex-col gap-4 border-l-2 border-slate-200">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-tighter">#ID-{loan.id}</span>
                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${loan.repaid ? 'bg-emerald-50 text-emerald-600' : loan.funded ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                            {loan.repaid ? 'Settled' : loan.funded ? 'Active' : 'Unfunded'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-2xl font-bold text-text-primary tracking-tight">{loan.amount} <span className="text-xs text-text-secondary font-normal ml-1">ETH</span></p>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mt-1.5">Interest: {loan.interest} ETH</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary mb-1">Counterparty</p>
                                            <p className="text-[10px] font-mono text-slate-500">{loan.lender === ethers.ZeroAddress ? 'Open Market' : `${loan.lender.slice(0, 6)}...${loan.lender.slice(-4)}`}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Funded Loans */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-primary px-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full 0"></div> Funded by You
                        </h3>
                        {onChainLoans.funded.length === 0 ? (
                            <div className="premium-card !p-8 text-center text-text-primary text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-border">Zero Records</div>
                        ) : (
                            onChainLoans.funded.map(loan => (
                                <div key={loan.id} className="premium-card !p-6 flex flex-col gap-4 border-l-2 border-border0/30">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[9px] font-mono text-text-secondary0 font-black">#ID-{loan.id}</span>
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${loan.repaid ? '0/10 text-brand-accent0' : '0/10 text-brand-accent0'}`}>
                                            {loan.repaid ? 'Settled' : 'Active'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-2xl font-black text-text-primary italic tracking-tighter">{loan.amount} <span className="text-[10px] not-italic text-text-primary ml-1">ETH</span></p>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary0 mt-1">ROI: +{loan.interest} ETH</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-secondary0 mb-1">Borrower</p>
                                            <p className="text-[8px] font-mono text-text-secondary">{loan.borrower.slice(0, 6)}...{loan.borrower.slice(-4)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* ── Installment Agreements (Factory) ── */}
            {addresses.loanFactory && (
                <section className="pt-8" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-text-primary">Installment Agreements</h2>
                            <p className="text-sm text-text-secondary mt-1">Active P2P loan contracts — pay monthly installments on-chain.</p>
                        </div>
                        {agreementsLoading && <FiLoader size={16} className="animate-spin" style={{ color: '#2563EB' }} />}
                    </div>

                    {agreements.length === 0 && !agreementsLoading ? (
                        <div className="premium-card py-16 text-center space-y-4 border-2 border-dashed border-border">
                            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-text-primary">
                                <FiCalendar size={32} />
                            </div>
                            <p className="text-text-secondary0 font-bold italic">No active factory agreements yet.</p>
                            <p className="text-text-primary text-sm">Post a loan request on the Borrow page and wait for a lender to fund it.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {agreements.map(agr => {
                                const progress = agr.totalDuration > 0 ? (agr.paymentsMade / agr.totalDuration) * 100 : 0;
                                const nextDue = new Date(agr.nextDueTimestamp * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                                return (
                                    <div key={agr.address} className="premium-card !p-6" style={{ borderLeft: `4px solid ${agr.completed ? '#16A34A' : agr.isOverdue ? '#DC2626' : agr.isDue ? '#D97706' : '#2563EB'}` }}>
                                        <div className="flex justify-between items-start mb-5">
                                            <div>
                                                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Agreement</p>
                                                <p className="text-xs font-mono text-text-secondary">{agr.address.slice(0, 10)}...{agr.address.slice(-6)}</p>
                                            </div>
                                            <span className={agr.completed ? 'badge-success' : agr.isDue ? 'badge-warning' : 'badge'}>
                                                {agr.completed ? 'Completed' : agr.isDue ? 'Payment Due' : 'Active'}
                                            </span>
                                        </div>

                                        {/* Monthly payment */}
                                        <div className="mb-5 flex justify-between items-end">
                                            <div>
                                                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Monthly Installment</p>
                                                <p className="text-2xl font-bold text-text-primary">{agr.monthlyPayment} <span className="text-text-secondary text-sm font-normal">{agr.mode === 0 ? 'ETH' : 'tUSDT'}</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Total Remaining</p>
                                                <p className="text-lg font-bold" style={{ color: '#2563EB' }}>{(Number(agr.monthlyPayment) * agr.remainingPayments).toFixed(2)} {agr.mode === 0 ? 'ETH' : 'tUSDT'}</p>
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

                                        {/* Stats */}
                                        <div className="grid grid-cols-4 gap-2 mb-6 rounded-xl p-3 text-center bg-slate-50 border border-slate-100">
                                            <div>
                                                <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Paid</p>
                                                <p className="text-text-primary font-bold">{agr.paymentsMade}/{agr.totalDuration}</p>
                                            </div>
                                            <div className="border-x border-slate-200">
                                                <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Left</p>
                                                <p className="text-brand-accent font-bold">{agr.remainingPayments}</p>
                                            </div>
                                            <div className="border-r border-slate-200">
                                                <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Missed</p>
                                                <p className="text-brand-accent font-bold">{agr.missedPayments}</p>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-center gap-1">
                                                    <FiCalendar size={11} className="text-text-secondary" />
                                                    <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Due</p>
                                                </div>
                                                <p className="text-[10px] text-text-secondary font-bold">{agr.completed ? '—' : nextDue}</p>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mb-6">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Repayment Progress</p>
                                                <p className="text-[10px] text-text-secondary font-bold">{progress.toFixed(0)}%</p>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: '#2563EB' }} />
                                            </div>
                                        </div>

                                        {/* Autopay Approval Warning/Button */}
                                        {agr.mode === 1 && !agr.completed && Number(agr.allowance) < Number(agr.monthlyPayment) && (
                                            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <div className="flex items-start gap-3">
                                                    <FiAlertCircle className="text-amber-600 mt-0.5" size={18} />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-amber-800">Autopay Restricted</p>
                                                        <p className="text-xs text-amber-700 mb-3">You must authorize the contract to pull tUSDT for automatic repayments.</p>
                                                        <button
                                                            onClick={() => handleApproveAutopay(agr)}
                                                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <FiShield size={14} /> Approve for Autopay
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Pay button */}
                                        {!agr.completed && (
                                            <button
                                                onClick={() => handlePayInstallment(agr)}
                                                disabled={!agr.isDue || payingInstallment === agr.address}
                                                className={`w-full btn-primary !py-3 ${!agr.isDue ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {payingInstallment === agr.address ? <><FiLoader className="animate-spin" size={16} /> Paying...</> : agr.isDue ? `Pay ${agr.monthlyPayment} ${agr.mode === 0 ? 'ETH' : 'tUSDT'}` : `Next Due: ${nextDue}`}
                                            </button>
                                        )}

                                        {agr.completed && (
                                            <div className="flex items-center justify-center gap-2 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                                <FiCheckCircle style={{ color: '#16A34A' }} />
                                                <span className="text-sm font-semibold" style={{ color: '#16A34A' }}>Fully Repaid</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
            {/* ── Trust Score History Section ── */}
            <section className="pt-8" style={{ borderTop: '1px solid #E2E8F0' }}>
                <button onClick={() => setShowTrustHistory(v => !v)} className="w-full flex items-center justify-between pb-5 group">
                    <div>
                        <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                            <FiAward style={{ color: '#2563EB' }} size={18} /> Trust Score History
                        </h2>
                        <p className="text-sm text-text-secondary mt-1">Full audit trail of your reputation updates.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-text-secondary group-hover:text-text-primary transition-colors">
                        <span className="text-xs font-semibold">{showTrustHistory ? 'Collapse' : 'Expand'}</span>
                        {showTrustHistory ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                    </div>
                </button>

                {showTrustHistory && (
                    <div>
                        {trustData.trustHistory.length === 0 ? (
                            <div className="premium-card py-12 text-center border-2 border-dashed border-border">
                                <p className="text-text-primary font-bold italic">No trust score history yet.</p>
                                <p className="text-text-primary text-sm font-medium mt-1">Complete KYC, mint your SBT, and repay loans to build history.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {trustData.trustHistory.map((entry, idx) => (
                                    <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ backgroundColor: entry.points >= 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${entry.points >= 0 ? '#BBF7D0' : '#FECACA'}` }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: entry.points >= 0 ? '#DCFCE7' : '#FEE2E2', color: entry.points >= 0 ? '#16A34A' : '#DC2626' }}>
                                                {entry.points >= 0 ? '+' : ''}{entry.points}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-primary">{entry.action}</p>
                                                <p className="text-xs text-text-secondary">{new Date(entry.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-text-secondary font-medium">New Score</p>
                                            <p className="text-base font-bold text-text-primary">{entry.newScore}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default BorrowerDashboard;

