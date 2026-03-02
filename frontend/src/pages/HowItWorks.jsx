import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    FiShield, FiLayers, FiRefreshCcw, FiStar, FiGlobe,
    FiUser, FiArrowRight, FiCreditCard, FiDollarSign,
    FiLock, FiActivity, FiCheckCircle, FiTrendingUp, FiAward
} from 'react-icons/fi';

const HowItWorks = () => {
    const navigate = useNavigate();

    const stepColors = [
        { border: '#2563EB', iconBg: '#EFF6FF', iconColor: '#2563EB' },
        { border: '#16A34A', iconBg: '#F0FDF4', iconColor: '#16A34A' },
        { border: '#D97706', iconBg: '#FFFBEB', iconColor: '#D97706' },
        { border: '#9333EA', iconBg: '#FAF5FF', iconColor: '#9333EA' },
        { border: '#DC2626', iconBg: '#FEF2F2', iconColor: '#DC2626' },
        { border: '#0D9488', iconBg: '#F0FDFA', iconColor: '#0D9488' },
        { border: '#EA580C', iconBg: '#FFF7ED', iconColor: '#EA580C' },
        { border: '#4F46E5', iconBg: '#EEF2FF', iconColor: '#4F46E5' },
    ];

    const steps = [
        {
            icon: <FiUser />,
            step: "01",
            title: "Identity Layer — Sign Up & KYC",
            points: [
                "Register with email and password",
                "Submit your 12-digit Aadhaar number for document verification",
                "Pass a biometric liveness scan (webcam-based)",
                "Connect your Ethereum wallet (MetaMask / WalletConnect)",
                "Mint your Soulbound Identity NFT on Sepolia — non-transferable, permanent",
                "Trust Score initialized at 300 pts, history entry created on-chain"
            ]
        },
        {
            icon: <FiLayers />,
            step: "02",
            title: "Role Assignment",
            points: [
                "Choose your protocol role: Borrower or Lender",
                "Role is stored in MongoDB and referenced from your wallet",
                "Borrowers access the loan request dashboard",
                "Lenders access the live marketplace and funded agreements tracker",
                "Role-based UI filtering — each dashboard shows only relevant data"
            ]
        },
        {
            icon: <FiCreditCard />,
            step: "03",
            title: "Borrower — Request Capital",
            points: [
                "Submit loan request: amount, interest rate, duration (months), and purpose",
                "Requires Soulbound NFT in wallet — non-verified wallets are rejected",
                "Request is stored in MongoDB and broadcast to the lender marketplace",
                "Post directly on-chain via LoanAgreementFactory.createLoanRequest()"
            ]
        },
        {
            icon: <FiDollarSign />,
            step: "04",
            title: "Lender — Deploy Capital",
            points: [
                "Browse live loan requests — sorted by on-chain trust scores",
                "Click 'Fund Loan' and approve in MetaMask",
                "LoanAgreementFactory.fundLoanRequest() deploys a unique LoanAgreement contract",
                "Principal forwarded directly to the borrower's wallet in the same transaction",
                "Lender Trust Score: +50 first loan funded, +10 for subsequent loans"
            ]
        },
        {
            icon: <FiRefreshCcw />,
            step: "05",
            title: "Monthly Repayments",
            points: [
                "Borrower pays each installment via payInstallment() on their LoanAgreement contract",
                "Each payment is split automatically on-chain:",
                "→ Lender receives: installment - insurance cut",
                "→ Treasury receives: 1% of totalRepayment ÷ durationMonths (dynamic insurance)",
                "Borrower Trust Score: +100 first repayment, +75 for subsequent repayments",
                "Loan marked 'Completed' on-chain when all installments are made"
            ]
        },
        {
            icon: <FiStar />,
            step: "06",
            title: "Trust Score & Tier System",
            points: [
                "Score range: 0 – 1000, stored in TrustScoreRegistry smart contract",
                "NFT Minted: +300 pts (base initialization)",
                "First loan funded (lender): +50 pts",
                "Subsequent loans funded: +10 pts each",
                "First repayment: +100 pts · Subsequent: +75 pts each",
                "Tiers: Bronze Pilot (0–99), Silver Verified (100–299), Gold Elite (300+)"
            ]
        },
        {
            icon: <FiDollarSign />,
            step: "07",
            title: "Dynamic Insurance Pool",
            points: [
                "Insurance fee = 1% of totalRepayment (100 basis points)",
                "Fee split across installments: insuranceFeePerInstallment = totalInsurance / duration",
                "On every repayment, cut goes to treasury address automatically",
                "No fixed fee — scales proportionally with loan size",
                "Example: 0.25 ETH repayment → 0.0025 ETH to insurance pool"
            ]
        },
        {
            icon: <FiGlobe />,
            step: "08",
            title: "Full On-Chain Audit",
            points: [
                "Every mint, fund, and repayment is on Ethereum Sepolia — verifiable forever",
                "SoulboundIdentity contract — NFT ownership verification",
                "TrustScoreRegistry — getTrustScore(address) readable by anyone",
                "LoanAgreement — getStatus() returns full loan state",
                "Backend event poller syncs on-chain state to MongoDB every 15 seconds"
            ]
        }
    ];

    const trustEvents = [
        { event: "NFT Minted", who: "Both", pts: "+300", color: '#2563EB' },
        { event: "First loan funded", who: "Lender", pts: "+50", color: '#0D9488' },
        { event: "Subsequent loans funded", who: "Lender", pts: "+10", color: '#16A34A' },
        { event: "First repayment", who: "Borrower", pts: "+100", color: '#9333EA' },
        { event: "Subsequent repayments", who: "Borrower", pts: "+75", color: '#D97706' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10 pb-16"
        >
            {/* Header */}
            <div className="text-center space-y-3 pt-2">
                <span className="section-label">Protocol Documentation</span>
                <h1 className="text-3xl md:text-4xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>How PanCred Works</h1>
                <p className="text-text-secondary max-w-2xl mx-auto text-sm leading-relaxed">
                    A complete walkthrough — from identity verification to on-chain repayments and dynamic insurance — built on Ethereum Sepolia.
                </p>
            </div>

            {/* Step Cards */}
            <div className="space-y-4">
                {steps.map((section, index) => {
                    const c = stepColors[index % stepColors.length];
                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: index % 2 === 0 ? -16 : 16 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.06 }}
                            className="premium-card flex items-start gap-5"
                            style={{ borderLeft: `4px solid ${c.border}` }}
                        >
                            <div className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center text-lg"
                                style={{ backgroundColor: c.iconBg, color: c.iconColor }}>
                                {section.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.iconColor }}>Step {section.step}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-text-primary mb-3">{section.title}</h3>
                                <ul className="space-y-1.5">
                                    {section.points.map((point, pi) => (
                                        <li key={pi} className={`flex items-start gap-2 text-sm text-text-secondary leading-relaxed ${point.startsWith('→') ? 'ml-4' : ''}`}>
                                            {!point.startsWith('→') && <FiCheckCircle className="flex-shrink-0 mt-0.5" size={12} style={{ color: c.iconColor }} />}
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Trust Score Table */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="premium-card"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                        <FiActivity size={16} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">On-chain Registry</p>
                        <h3 className="text-lg font-semibold text-text-primary">Trust Score Events</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider pb-3">Event</th>
                                <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider pb-3">Who</th>
                                <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider pb-3">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trustEvents.map((e, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: i < trustEvents.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                                    <td className="py-3 font-medium text-text-primary">{e.event}</td>
                                    <td className="py-3 text-text-secondary">{e.who}</td>
                                    <td className="py-3 text-right font-bold" style={{ color: e.color }}>{e.pts}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                                <td colSpan={3} className="pt-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                    Max Score: 1000 pts · Capped per TrustScoreRegistry.sol
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Tier Cards */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                {[
                    { tier: "Bronze Pilot", range: "0 – 99 pts", icon: <FiShield />, bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C' },
                    { tier: "Silver Verified", range: "100 – 299 pts", icon: <FiAward />, bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B' },
                    { tier: "Gold Elite", range: "300+ pts", icon: <FiStar />, bg: '#FFFBEB', border: '#FDE68A', color: '#D97706' },
                ].map((t, i) => (
                    <div key={i} className="premium-card text-center"
                        style={{ backgroundColor: t.bg, borderColor: t.border }}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3 text-lg"
                            style={{ backgroundColor: 'white', color: t.color, border: `1px solid ${t.border}` }}>
                            {t.icon}
                        </div>
                        <p className="text-base font-bold" style={{ color: t.color }}>{t.tier}</p>
                        <p className="text-xs font-medium text-text-secondary mt-1">{t.range}</p>
                    </div>
                ))}
            </motion.div>

            {/* CTA */}
            <div className="rounded-2xl p-10 text-center"
                style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3" style={{ letterSpacing: '-0.01em' }}>
                    Ready to start your journey?
                </h2>
                <p className="text-text-secondary mb-8 max-w-xl mx-auto text-sm leading-relaxed">
                    Join a growing network of verified participants. Mint your identity, build your trust score, and access decentralized capital — fully on-chain.
                </p>
                <button
                    onClick={() => navigate('/signup')}
                    className="btn-primary !px-10 !py-3.5"
                >
                    Get Started <FiArrowRight size={16} />
                </button>
            </div>
        </motion.div>
    );
};

export default HowItWorks;
