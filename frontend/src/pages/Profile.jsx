import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
    FiUser, FiShield, FiAward, FiActivity, FiExternalLink,
    FiCopy, FiStar, FiCheckCircle, FiLoader
} from 'react-icons/fi';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { checkIdentityOwnership, getSharedProvider } from '../blockchainService';
import addresses from '../contracts/addresses.json';
import trustScoreAbi from '../contracts/TrustScoreRegistry.json';
import toast from 'react-hot-toast';

const IDENTITY_CONTRACT_ADDRESS = addresses.identity;

const getTier = (score) => {
    if (score >= 300) return { label: 'Gold Elite', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
    if (score >= 100) return { label: 'Silver Verified', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' };
    return { label: 'Bronze Pilot', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' };
};

const Profile = () => {
    const { userProfile } = useAuth();
    const { address } = useAccount();

    const [hasNft, setHasNft] = useState(false);
    const [nftLoading, setNftLoading] = useState(true);
    const [onChainTrustScore, setOnChainTrustScore] = useState(0);

    const role = userProfile?.role || 'User';
    const walletAddr = address || userProfile?.walletAddress;

    useEffect(() => {
        const fetchChainData = async () => {
            if (walletAddr) {
                try {
                    const owned = await checkIdentityOwnership(walletAddr);
                    setHasNft(owned);

                    const provider = getSharedProvider();
                    const code = await provider.getCode(addresses.trustScore);
                    if (code !== "0x" && code !== "0x0") {
                        const trustContract = new ethers.Contract(addresses.trustScore, trustScoreAbi, provider);
                        const score = await trustContract.getTrustScore(walletAddr);
                        setOnChainTrustScore(Number(score));
                    }
                } catch (err) {
                    console.error("Chain Data fetch error:", err);
                } finally {
                    setNftLoading(false);
                }
            } else {
                setNftLoading(false);
            }
        };
        fetchChainData();

        const interval = setInterval(fetchChainData, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [walletAddr]);

    const copyAddress = (addr) => {
        navigator.clipboard.writeText(addr);
        toast.success("Address copied");
    };

    const tier = getTier(onChainTrustScore);
    const progressPercent = Math.min(100, (onChainTrustScore / 1000) * 100);

    return (
        <div className="space-y-6 md:space-y-8 p-1">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-text-primary">My Profile</h1>
                    <p className="text-sm text-text-secondary mt-1">Your decentralized identity on the PanCred protocol.</p>
                </div>
                {/* Trust Score Badge */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl"
                    style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <FiAward style={{ color: '#2563EB' }} size={20} />
                    <div>
                        <p className="text-xs text-text-secondary font-medium">On-Chain Score</p>
                        <p className="text-xl font-bold" style={{ color: '#2563EB' }}>{onChainTrustScore}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Identity Info */}
                    <section className="premium-card">
                        <div className="flex items-center gap-2 mb-6">
                            <FiUser style={{ color: '#2563EB' }} size={16} />
                            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Account Details</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Full Name</label>
                                <p className="text-lg font-semibold text-text-primary">{userProfile?.name || 'Protocol User'}</p>
                                <p className="text-sm text-text-secondary">{userProfile?.email}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Wallet Address</label>
                                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <p className="font-mono text-xs text-text-secondary truncate flex-1">{walletAddr || '—'}</p>
                                    {walletAddr && (
                                        <button onClick={() => copyAddress(walletAddr)}
                                            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-all">
                                            <FiCopy size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Protocol Role</label>
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                                    style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2563EB' }}></div>
                                    <p className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>{role}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Trust Score Progress */}
                    <section className="premium-card">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <FiStar style={{ color: '#2563EB' }} size={16} />
                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Trust Progression</span>
                            </div>
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                                {tier.label}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between text-sm font-medium">
                                <span className="text-text-secondary">Network Strength</span>
                                <span className="font-bold text-text-primary">{onChainTrustScore} <span className="text-text-secondary font-normal">/ 1000 pts</span></span>
                            </div>
                            <div className="h-3 w-full rounded-full" style={{ backgroundColor: '#E2E8F0' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: '#2563EB' }}
                                />
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed flex items-start gap-2">
                                <FiActivity size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#2563EB' }} />
                                Trust score is recalculated on-chain after every repayment. Higher scores unlock increased capital ceilings and lower fee structures.
                            </p>
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <aside className="space-y-6">
                    {/* SBT Card */}
                    <div className="premium-card text-center">
                        <div className={`w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center transition-all duration-300`}
                            style={{
                                backgroundColor: hasNft ? '#EFF6FF' : '#F8FAFC',
                                border: `2px solid ${hasNft ? '#BFDBFE' : '#E2E8F0'}`
                            }}>
                            <FiShield size={40} style={{ color: hasNft ? '#2563EB' : '#94A3B8' }} />
                        </div>
                        <h4 className="text-lg font-bold text-text-primary mb-1">PanCred ID</h4>
                        <p className="text-xs text-text-secondary font-medium uppercase tracking-wider mb-5">Soulbound Identity NFT</p>

                        {nftLoading ? (
                            <FiLoader className="animate-spin mx-auto" size={18} style={{ color: '#2563EB' }} />
                        ) : (
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${hasNft ? 'badge-success' : 'badge'}`}>
                                {hasNft ? <><FiCheckCircle size={13} /> Verified</> : 'Not Detected'}
                            </div>
                        )}

                        {hasNft && (
                            <div className="mt-5 pt-5" style={{ borderTop: '1px solid #E2E8F0' }}>
                                <a
                                    href={`https://sepolia.etherscan.io/address/${IDENTITY_CONTRACT_ADDRESS}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-medium text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-1.5"
                                >
                                    View on Etherscan <FiExternalLink size={11} />
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Protocol Contracts */}
                    <div className="premium-card space-y-5">
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Protocol Contracts</p>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold text-text-primary mb-1.5">Identity Gateway</p>
                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs font-mono text-text-secondary truncate">{addresses.identity}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-text-primary mb-1.5">Reputation Engine</p>
                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs font-mono text-text-secondary truncate">{addresses.trustScore}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Profile;
