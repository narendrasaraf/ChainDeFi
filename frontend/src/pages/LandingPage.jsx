import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FiArrowRight, FiShield, FiTrendingUp, FiLayers, FiCheckCircle,
    FiLock, FiZap, FiDollarSign, FiAward, FiUsers, FiGlobe,
    FiCreditCard, FiActivity, FiEye
} from 'react-icons/fi';
import { getSBTCount } from '../blockchainService';

const LandingPage = () => {
    const navigate = useNavigate();
    const [sbtCount, setSbtCount] = useState(null);

    useEffect(() => {
        getSBTCount().then((count) => setSbtCount(count));
    }, []);

    const pillars = [
        {
            icon: <FiShield />,
            title: "Soulbound Identity NFT",
            description: "Non-transferable on-chain identity minted after Aadhaar + biometric KYC. Your key to the entire protocol.",
            cardClass: "card-blue",
            iconBg: "#EFF6FF",
            iconColor: "#2563EB",
            tag: "ERC-721 Soulbound"
        },
        {
            icon: <FiTrendingUp />,
            title: "Dynamic Trust Score",
            description: "On-chain reputation built from real actions — NFT mint, loan funding, and repayments. Starts at 300, grows to 1000.",
            cardClass: "card-green",
            iconBg: "#F0FDF4",
            iconColor: "#16A34A",
            tag: "0–1000 Scale"
        },
        {
            icon: <FiLayers />,
            title: "P2P Lending Market",
            description: "Borrowers post requests, lenders fund them directly. Capital flows peer-to-peer via immutable smart contracts — no bank.",
            cardClass: "card-purple",
            iconBg: "#FAF5FF",
            iconColor: "#9333EA",
            tag: "Permissionless"
        },
        {
            icon: <FiDollarSign />,
            title: "Dynamic Insurance Pool",
            description: "1% of every loan's total repayment is auto-routed to the protocol treasury on each installment. Fair, proportional pricing.",
            cardClass: "card-teal",
            iconBg: "#F0FDFA",
            iconColor: "#0D9488",
            tag: "1% Dynamic Fee"
        },
        {
            icon: <FiCreditCard />,
            title: "Installment Agreements",
            description: "Each funded loan deploys a unique LoanAgreement contract. Borrower repays in monthly installments — lender tracks in real-time.",
            cardClass: "card-amber",
            iconBg: "#FFFBEB",
            iconColor: "#D97706",
            tag: "Monthly Installments"
        },
        {
            icon: <FiEye />,
            title: "Full On-Chain Audit",
            description: "Every transaction — mint, fund, repay — is permanently recorded on Ethereum Sepolia. Verifiable by anyone, anytime.",
            cardClass: "card-blue",
            iconBg: "#EFF6FF",
            iconColor: "#2563EB",
            tag: "Fully Transparent"
        }
    ];

    const howItWorks = [
        {
            step: "01",
            title: "Sign Up & Verify Identity",
            desc: "Register, complete Aadhaar + biometric KYC, connect your wallet. Your Soulbound Identity NFT is minted — trust score starts at 300.",
            borderColor: "#2563EB"
        },
        {
            step: "02",
            title: "Choose Your Role",
            desc: "Select Borrower or Lender. Borrowers post loan requests with amount, interest rate, and purpose. Lenders browse the live marketplace.",
            borderColor: "#9333EA"
        },
        {
            step: "03",
            title: "Fund or Request Capital",
            desc: "Lenders deploy ETH directly to borrowers via a LoanAgreementFactory contract. Principal is forwarded instantly to the borrower's wallet. Lender trust score +50.",
            borderColor: "#0D9488"
        },
        {
            step: "04",
            title: "Repay in Installments",
            desc: "Borrowers repay monthly. Each installment: lender receives principal+interest minus 1% insurance cut. Borrower trust score +100 (first) or +75 (subsequent).",
            borderColor: "#D97706"
        },
        {
            step: "05",
            title: "Build Reputation On-Chain",
            desc: "Every action is recorded on the TrustScoreRegistry contract. Higher score = better rates, higher loan limits, and Bronze → Silver → Gold tier unlocks.",
            borderColor: "#16A34A"
        }
    ];

    const fullFeatures = [
        { icon: <FiShield />, label: "Soulbound NFT Identity (ERC-721)", color: "#2563EB" },
        { icon: <FiZap />, label: "Biometric + Aadhaar KYC", color: "#9333EA" },
        { icon: <FiTrendingUp />, label: "On-chain Trust Score (0–1000)", color: "#16A34A" },
        { icon: <FiAward />, label: "Bronze / Silver / Gold Tiers", color: "#D97706" },
        { icon: <FiLayers />, label: "P2P Loan Marketplace", color: "#0D9488" },
        { icon: <FiCreditCard />, label: "Per-Loan Agreement Contracts", color: "#2563EB" },
        { icon: <FiDollarSign />, label: "Dynamic 1% Insurance Pool", color: "#16A34A" },
        { icon: <FiActivity />, label: "Real-time Installment Tracking", color: "#9333EA" },
        { icon: <FiUsers />, label: "Borrower & Lender Dashboards", color: "#0D9488" },
        { icon: <FiGlobe />, label: "Live on Ethereum Sepolia", color: "#2563EB" },
        { icon: <FiLock />, label: "Signer-gated Transactions", color: "#D97706" },
        { icon: <FiEye />, label: "Full On-Chain Audit Trail", color: "#16A34A" },
    ];

    return (
        <div className="min-h-screen font-sans text-text-secondary overflow-x-hidden" style={{ backgroundColor: '#FFFFFF' }}>
            <main>
                {/* ── Hero ── */}
                <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 md:px-6">
                    <div className="global-container text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
                                style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                                <FiCheckCircle size={13} /> Live on Ethereum Sepolia
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                                Microfinance <span style={{ color: '#2563EB' }}>Reimagined.</span>
                            </h1>

                            <p className="text-base md:text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
                                Peer-to-peer lending powered by decentralized identity, on-chain trust scores, and dynamic insurance — a transparent financial network with no intermediaries.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto sm:max-w-none">
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="btn-primary !px-8 !py-3.5 text-sm w-full sm:w-auto"
                                >
                                    Get Started <FiArrowRight size={16} />
                                </button>
                                <button
                                    onClick={() => navigate('/how-it-works')}
                                    className="btn-ghost !px-8 !py-3.5 text-sm w-full sm:w-auto"
                                >
                                    How it Works
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* ── Stats Bar ── */}
                <section className="py-12 md:py-16" style={{ borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                    <div className="global-container grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
                        {[
                            { val: "1%", label: "Dynamic Insurance Fee" },
                            {
                                val: sbtCount === null
                                    ? <span className="animate-pulse text-text-primary">...</span>
                                    : sbtCount === 0 || sbtCount ? sbtCount : "–",
                                label: "SBT Identities Minted"
                            },
                            { val: "0→1000", label: "Trust Score Scale" },
                            { val: "100%", label: "On-Chain Audit" }
                        ].map((s, i) => (
                            <div key={i} className="space-y-1">
                                <div className="text-2xl md:text-3xl font-bold text-text-primary leading-none" style={{ color: '#2563EB' }}>{s.val}</div>
                                <div className="text-xs text-text-secondary font-medium uppercase tracking-wide mt-2">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── How It Works ── */}
                <section className="py-16 md:py-24 px-4 md:px-6">
                    <div className="global-container">
                        <div className="text-center mb-12 md:mb-16">
                            <span className="section-label">End-to-End Flow</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>How PanCred Works</h2>
                        </div>

                        <div className="space-y-5 max-w-3xl mx-auto">
                            {howItWorks.map((step, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08, duration: 0.4 }}
                                    className="premium-card !p-6 flex gap-5 items-start"
                                    style={{ borderLeft: `4px solid ${step.borderColor}` }}
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                                        style={{ backgroundColor: step.borderColor }}>
                                        {step.step}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-text-primary mb-1">{step.title}</h3>
                                        <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Pillars / Core Features ── */}
                <section className="py-16 md:py-24 px-4 md:px-6" style={{ backgroundColor: '#F8FAFC' }}>
                    <div className="global-container">
                        <div className="text-center mb-12 md:mb-16">
                            <span className="section-label">Protocol Architecture</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>The Pillars of PanCred</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {pillars.map((f, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 16 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.07 }}
                                    viewport={{ once: true }}
                                    className={`premium-card ${f.cardClass} !p-7 group`}
                                >
                                    <div className="w-12 h-12 mb-5 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300"
                                        style={{ backgroundColor: f.iconBg, color: f.iconColor }}>
                                        {f.icon}
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: f.iconColor }}>{f.tag}</span>
                                    <h3 className="text-lg font-semibold text-text-primary mb-2">{f.title}</h3>
                                    <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Full Feature List ── */}
                <section className="py-16 md:py-24 px-4 md:px-6">
                    <div className="global-container">
                        <div className="text-center mb-12">
                            <span className="section-label">Everything Built-In</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>Complete Feature Set</h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {fullFeatures.map((f, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.04 }}
                                    className="premium-card !p-4 flex items-center gap-3 group"
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                                        style={{ backgroundColor: f.color + '15', color: f.color }}>
                                        {f.icon}
                                    </div>
                                    <span className="text-xs font-medium text-text-secondary leading-tight">{f.label}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ── */}
                <section className="py-16 md:py-24 px-4 md:px-6" style={{ backgroundColor: '#F8FAFC' }}>
                    <div className="global-container">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="rounded-2xl p-10 md:p-16 text-center"
                            style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
                        >
                            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4" style={{ letterSpacing: '-0.01em' }}>
                                Ready to get started?
                            </h2>
                            <p className="text-text-secondary max-w-xl mx-auto mb-8 leading-relaxed">
                                Join the network. Mint your identity, build your trust score, and access decentralized capital — all on-chain.
                            </p>
                            <button
                                onClick={() => navigate('/signup')}
                                className="btn-primary !px-10 !py-3.5 text-sm"
                            >
                                Create Account <FiArrowRight size={16} />
                            </button>
                        </motion.div>
                    </div>
                </section>
            </main>

            <footer className="py-10 px-4 md:px-6 text-center" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div className="global-container">
                    <div className="flex items-center justify-center gap-2.5 mb-6">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2563EB' }}>
                            <FiShield className="text-white" size={13} />
                        </div>
                        <span className="text-base font-bold text-text-primary">PanCred</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-text-secondary mb-6">
                        <a href="#" className="hover:text-text-primary transition-colors">Whitepaper</a>
                        <a href="#" className="hover:text-text-primary transition-colors">Protocol Status</a>
                        <a href="#" className="hover:text-text-primary transition-colors">Privacy</a>
                    </div>
                    <p className="text-sm text-text-secondary">© 2026 PanCred Finance. Built with conviction.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
