import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
    FiTrendingUp, FiShield, FiArrowRight, FiLoader,
    FiCheckCircle, FiAlertCircle, FiSend, FiInfo, FiLock, FiUnlock, FiAward
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { checkIdentityOwnership, parseBlockchainError } from '../blockchainService';
import addresses from '../contracts/addresses.json';
import _factoryJson from '../contracts/LoanAgreementFactory.json';
import _usdtJson from '../contracts/MockUSDT.json';

const factoryAbi = Array.isArray(_factoryJson) ? _factoryJson : _factoryJson.abi;
const usdtAbi = Array.isArray(_usdtJson) ? _usdtJson : _usdtJson.abi;

// ─── Trust Score Banner ──────────────────────────────────────────────────────
const TrustScoreBanner = ({ trustScore, completedLoans }) => {
    const ETH_THRESHOLD = 700;
    const progress = Math.min(100, Math.max(0, ((trustScore - 300) / (ETH_THRESHOLD - 300)) * 100));
    const isEligible = completedLoans >= 1 && trustScore >= ETH_THRESHOLD;

    const getTier = (score) => {
        if (score >= 850) return { label: 'Prime', color: '#7C3AED', bg: '#FAF5FF', border: '#DDD6FE' };
        if (score >= 700) return { label: 'Trusted', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' };
        if (score >= 500) return { label: 'Building Credit', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
        return { label: 'New Borrower', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' };
    };

    const tier = getTier(trustScore);

    return (
        <div className="premium-card !p-6 md:!p-8 mb-8" style={{ borderLeft: '4px solid #2563EB' }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#EFF6FF' }}>
                        <FiAward size={26} style={{ color: '#2563EB' }} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Trust Score</p>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold text-text-primary">{trustScore}</span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                                {tier.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 max-w-xs">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-text-secondary">ETH Unlock Progress</p>
                        <p className="text-xs text-text-secondary font-medium">{trustScore} / {ETH_THRESHOLD}</p>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${progress}%`,
                                backgroundColor: isEligible ? '#16A34A' : '#2563EB'
                            }}
                        />
                    </div>
                    <p className="text-xs font-medium mt-1.5" style={{ color: isEligible ? '#16A34A' : '#64748B' }}>
                        {isEligible ? '🔓 ETH Mode Unlocked' : `${ETH_THRESHOLD - trustScore} pts to unlock ETH mode`}
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Completed Loans</p>
                    <p className="text-2xl font-bold text-text-primary">{completedLoans}</p>
                </div>
            </div>
        </div>
    );
};

// ─── Loan Request Form ──────────────────────────────────────────────────────
const LoanRequestForm = ({ walletAddress, walletClient, userProfile, trustScore, completedLoans }) => {
    const [principal, setPrincipal] = useState('');
    const [totalRepayment, setTotalRepayment] = useState('');
    const [duration, setDuration] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const canUseEth = completedLoans >= 1 && trustScore >= 700;
    const [loanMode, setLoanMode] = useState(1);
    const [tokenSymbol, setTokenSymbol] = useState('...');
    const [tokenDecimals, setTokenDecimals] = useState(18);

    useEffect(() => {
        const fetchTokenData = async () => {
            if (loanMode === 1 && walletClient && addresses.mockUSDT) {
                try {
                    const provider = new ethers.BrowserProvider(walletClient.transport);
                    const token = new ethers.Contract(addresses.mockUSDT, usdtAbi, provider);
                    setTokenSymbol(await token.symbol());
                    setTokenDecimals(Number(await token.decimals()));
                } catch (e) {
                    setTokenSymbol("tUSDT");
                    setTokenDecimals(6);
                }
            }
        };
        fetchTokenData();
    }, [loanMode, walletClient]);

    const impliedAPR = (() => {
        if (!principal || !totalRepayment || !duration) return null;
        const interest = Number(totalRepayment) - Number(principal);
        if (interest < 0) return null;
        const apr = ((interest / Number(principal)) / Number(duration)) * 12 * 100;
        return apr.toFixed(1);
    })();

    const monthlyPayment = (() => {
        if (!totalRepayment || !duration) return null;
        return (Number(totalRepayment) / Number(duration)).toFixed(6);
    })();

    const hasFactory = !!addresses.loanFactory;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasFactory) { toast.error('Factory not deployed.'); return; }

        const principalNum = Number(principal);
        const repaymentNum = Number(totalRepayment);
        const durationNum = Number(duration);

        if (repaymentNum < principalNum) { toast.error('Total repayment must be ≥ principal'); return; }
        if (durationNum < 1 || durationNum > 36) { toast.error('Duration must be 1–36 months'); return; }
        if (loanMode === 0 && !canUseEth) { toast.error('ETH loans require Trust Score ≥ 700 and 1 completed loan.'); return; }
        if (!window.ethereum) { toast.error('MetaMask not found'); return; }

        const tid = toast.loading('Preparing loan ad...');
        setSubmitting(true);
        try {
            // Use window.ethereum directly to avoid MetaMask's broken ERC20 rendering path
            const provider = new ethers.BrowserProvider(window.ethereum);
            const network = await provider.getNetwork();
            if (network.chainId !== 11155111n) {
                toast.dismiss(tid);
                toast.error('Please switch MetaMask to the Sepolia network first.');
                return;
            }

            const signer = await provider.getSigner();
            const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, signer);

            const principalWei = loanMode === 0 ? ethers.parseEther(principal.toString()) : ethers.parseUnits(principal.toString(), tokenDecimals);
            const repaymentWei = loanMode === 0 ? ethers.parseEther(totalRepayment.toString()) : ethers.parseUnits(totalRepayment.toString(), tokenDecimals);

            toast.loading('Confirm in wallet...', { id: tid });
            const tx = await factory.createLoanRequestWithMode(principalWei, repaymentWei, durationNum, loanMode);
            toast.loading('Broadcasting to Sepolia...', { id: tid });
            const receipt = await tx.wait();

            // Extract on-chain ID from event logs
            let onChainId = null;
            try {
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = factory.interface.parseLog(log);
                        return parsed && parsed.name === 'LoanRequested';
                    } catch { return false; }
                });
                if (event) {
                    onChainId = factory.interface.parseLog(event).args.id.toString();
                    console.log("[Borrow] Captured On-Chain ID:", onChainId);
                }
            } catch (e) {
                console.error("Failed to parse event:", e);
            }

            toast.loading('Syncing with protocol...', { id: tid });

            await api.post('/loans', {
                borrowerId: userProfile._id,
                amountRequested: principalNum,
                interestRate: impliedAPR ? Number(impliedAPR) : 10,
                durationMonths: durationNum,
                purpose: loanMode === 0 ? "ETH Request" : "ERC20 Request",
                txHash: receipt.hash,
                loanMode,
                simulatedSmartContractId: onChainId
            });

            toast.success('Loan ad posted on-chain!', { id: tid });
            setSubmitted(true);
            setPrincipal(''); setTotalRepayment(''); setDuration('');
        } catch (err) {
            toast.error(parseBlockchainError(err), { id: tid });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="premium-card" style={{ borderLeft: '4px solid #2563EB' }}>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <FiSend size={18} style={{ color: '#2563EB' }} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-text-primary">Post Loan Request</h3>
                    <p className="text-xs text-text-secondary">Published on-chain · Visible to all lenders</p>
                </div>
            </div>

            {!hasFactory && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <FiAlertCircle style={{ color: '#DC2626' }} className="flex-shrink-0" />
                    <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
                        Factory not deployed. Run: <code className="font-mono">npx hardhat run scripts/deployFactory.js --network sepolia</code>
                    </p>
                </div>
            )}

            {submitted && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <FiCheckCircle style={{ color: '#16A34A' }} className="flex-shrink-0" />
                    <p className="text-xs font-medium" style={{ color: '#16A34A' }}>Ad posted. Visit the Lender marketplace to see it live.</p>
                </div>
            )}

            {/* Mode Selector */}
            <div className="flex rounded-xl p-1 mb-5" style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                <button type="button" onClick={() => setLoanMode(1)}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all"
                    style={loanMode === 1
                        ? { backgroundColor: '#FFFFFF', color: '#1E293B', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
                        : { color: '#64748B' }}>
                    ERC20 {tokenSymbol !== '...' ? `(${tokenSymbol})` : ''}
                </button>
                <button type="button"
                    onClick={() => { if (canUseEth) setLoanMode(0); }}
                    disabled={!canUseEth}
                    className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={loanMode === 0
                        ? { backgroundColor: '#FFFFFF', color: '#1E293B', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
                        : { color: '#64748B' }}>
                    {canUseEth ? <FiUnlock size={11} /> : <FiLock size={11} />} ETH
                </button>
            </div>

            {!canUseEth && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl mb-5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <FiLock className="flex-shrink-0 mt-0.5" size={13} style={{ color: '#D97706' }} />
                    <p className="text-xs font-medium leading-relaxed" style={{ color: '#92400E' }}>
                        {completedLoans === 0
                            ? <>First loan must use <strong>ERC20</strong> (autopay mandatory). Complete it to unlock ETH mode.</>
                            : <>Unlock ETH loans at Trust Score <strong>700</strong>. Your score: <strong>{trustScore}</strong> ({700 - trustScore} more needed).</>
                        }
                    </p>
                </div>
            )}

            {loanMode === 0 ? (
                <div className="flex items-start gap-3 p-3.5 rounded-xl mb-5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <FiAlertCircle className="flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
                    <p className="text-xs font-medium" style={{ color: '#92400E' }}>Automatic repayment not available for ETH loans. You must trigger payments manually each month.</p>
                </div>
            ) : (
                <div className="flex items-start gap-3 p-3.5 rounded-xl mb-5" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <FiCheckCircle className="flex-shrink-0 mt-0.5" style={{ color: '#16A34A' }} />
                    <p className="text-xs font-medium" style={{ color: '#166534' }}>Automatic repayment enabled via ERC20 approval. Installments are processed automatically.</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Principal ({loanMode === 0 ? 'ETH' : tokenSymbol}) — Amount you need
                        </label>
                        <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)}
                            required min="0.000001" step="any" placeholder="0.500"
                            className="form-input font-mono text-lg" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Total Repayment ({loanMode === 0 ? 'ETH' : tokenSymbol}) — You pay back
                        </label>
                        <input type="number" value={totalRepayment} onChange={e => setTotalRepayment(e.target.value)}
                            required min="0.000001" step="any" placeholder="0.600"
                            className="form-input font-mono text-lg" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Duration (Months) — 1 to 36</label>
                    <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                        required min="1" max="36" step="1" placeholder="2"
                        className="form-input text-lg" />
                </div>

                {monthlyPayment && impliedAPR && (
                    <div className="rounded-xl p-5 grid grid-cols-3 gap-4 text-center"
                        style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div>
                            <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Monthly</p>
                            <p className="text-text-primary font-bold text-sm">{monthlyPayment} <span className="text-text-secondary text-xs font-normal">{loanMode === 0 ? 'ETH' : tokenSymbol}</span></p>
                        </div>
                        <div>
                            <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Implied APR</p>
                            <p className="font-bold text-sm" style={{ color: '#2563EB' }}>{impliedAPR}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Insurance</p>
                            <p className="font-bold text-sm" style={{ color: '#0D9488' }}>0.01 <span className="text-text-secondary text-xs font-normal">{loanMode === 0 ? 'ETH' : tokenSymbol}</span></p>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <FiInfo className="flex-shrink-0 mt-0.5" size={14} style={{ color: '#64748B' }} />
                    <p className="text-xs text-text-secondary leading-relaxed">
                        Once a lender funds your request, a smart contract is deployed and principal is transferred to your wallet. A total of <strong className="text-text-primary">0.01 {loanMode === 0 ? 'ETH' : tokenSymbol} insurance fee</strong> is distributed across installments.
                    </p>
                </div>

                <button type="submit" disabled={submitting || !hasFactory} className="btn-primary w-full !py-4">
                    {submitting ? <><FiLoader className="animate-spin" size={16} /> Broadcasting...</> : <><FiSend size={15} /> Post Loan Request On-Chain</>}
                </button>
            </form>
        </div>
    );
};

// ─── Main Borrow Page ────────────────────────────────────────────────────────
const Borrow = () => {
    const navigate = useNavigate();
    const { address: walletAddress } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { userProfile, token } = useAuth();

    const [isVerified, setIsVerified] = useState(false);
    const [checking, setChecking] = useState(true);
    const [trustData, setTrustData] = useState({ trustScore: 300, completedLoans: 0 });
    const [trustLoading, setTrustLoading] = useState(true);

    useEffect(() => {
        const fetchTrustData = async () => {
            if (!userProfile) { setTrustLoading(false); return; }
            setTrustLoading(true);
            try {
                const res = await api.get('/users/me');
                if (res.data.success) {
                    setTrustData({ trustScore: res.data.data.trustScore ?? 300, completedLoans: res.data.data.completedLoans ?? 0 });
                }
            } catch (err) {
                setTrustData({ trustScore: userProfile.trustScore ?? 300, completedLoans: userProfile.completedLoans ?? 0 });
            } finally {
                setTrustLoading(false);
            }
        };
        fetchTrustData();
    }, [userProfile, token]);

    useEffect(() => {
        const checkNFT = async () => {
            if (!walletAddress) { setChecking(false); return; }
            setChecking(true);
            try {
                const provider = walletClient ? new ethers.BrowserProvider(walletClient.transport) : null;
                const verified = await checkIdentityOwnership(walletAddress, provider);
                setIsVerified(verified);
            } catch (err) {
                setIsVerified(false);
            } finally {
                setChecking(false);
            }
        };
        checkNFT();
    }, [walletAddress, walletClient]);

    return (
        <div className="space-y-6 md:space-y-8 p-1">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-3">
                    <FiTrendingUp style={{ color: '#2563EB' }} /> Borrow Capital
                </h1>
                <p className="text-sm text-text-secondary mt-1">Post a loan request — lenders fund directly to your wallet.</p>
            </header>

            {checking && (
                <div className="premium-card flex flex-col items-center justify-center gap-3 py-14">
                    <FiLoader size={28} className="animate-spin" style={{ color: '#2563EB' }} />
                    <p className="text-sm text-text-secondary font-medium">Verifying identity on-chain...</p>
                </div>
            )}

            {!checking && !isVerified && (
                <div className="premium-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <p className="text-sm md:text-base text-text-secondary mb-8 font-medium leading-relaxed max-w-2xl">
                        Access capital using your on-chain reputation score. No centralized credit checks, no hidden fees.
                    </p>
                    <div className="rounded-2xl p-8 md:p-10" style={{ border: '2px dashed #E2E8F0' }}>
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: '#EFF6FF' }}>
                                <FiShield size={36} style={{ color: '#2563EB' }} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-text-primary mb-1">Initialize Credit Profile</h3>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Before posting a loan request, you must verify your identity and mint a Soulbound Identity NFT.
                                </p>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 flex justify-end" style={{ borderTop: '1px solid #E2E8F0' }}>
                            <button onClick={() => navigate('/onboarding')} className="btn-primary !px-8 !py-3">
                                Get Verified & Mint NFT <FiArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!checking && isVerified && (
                <div className="space-y-6">
                    <div className="badge-success flex items-center gap-2 w-fit">
                        <FiCheckCircle size={14} /> Identity Verified — Credit Profile Active
                    </div>

                    {!trustLoading && <TrustScoreBanner trustScore={trustData.trustScore} completedLoans={trustData.completedLoans} />}

                    <LoanRequestForm
                        walletAddress={walletAddress}
                        walletClient={walletClient}
                        userProfile={userProfile}
                        trustScore={trustData.trustScore}
                        completedLoans={trustData.completedLoans}
                    />
                </div>
            )}
        </div>
    );
};

export default Borrow;
