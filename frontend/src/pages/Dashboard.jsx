import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BorrowerDashboard from './BorrowerDashboard';
import LenderDashboard from './LenderDashboard';
import { FiLoader, FiTrendingUp, FiUser, FiShield, FiDollarSign, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import addresses from '../contracts/addresses.json';
import { getSharedProvider } from '../blockchainService';

// ---------- Protocol Insurance Pool Widget ----------
const InsurancePoolWidget = () => {
    const [balance, setBalance] = useState("0");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const provider = getSharedProvider();
                const bal = await provider.getBalance(addresses.treasury);
                setBalance(ethers.formatEther(bal));
            } catch (err) {
                console.error("Failed to fetch treasury balance:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBalance();
    }, []);

    return (
        <div className="w-full px-4 py-3 mt-0" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#EFF6FF' }}>
                        <FiShield size={16} style={{ color: '#2563EB' }} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-text-primary">Protocol Insurance Pool</h4>
                        <p className="text-xs text-text-secondary">Securing lenders with 1% dynamic fee</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {loading ? (
                        <div className="h-5 w-24 animate-pulse rounded-md" style={{ backgroundColor: '#E2E8F0' }}></div>
                    ) : (
                        <div className="text-lg font-bold" style={{ color: '#2563EB' }}>
                            {Number(balance).toFixed(4)} <span className="text-sm font-semibold text-text-secondary">ETH</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------- Role Selector ----------
const RoleSelector = ({ onSelect }) => {
    const [selecting, setSelecting] = useState(null);

    const handleSelect = async (role) => {
        setSelecting(role);
        await onSelect(role);
        setSelecting(null);
    };

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-10 py-16 px-4">
            <div className="text-center space-y-3 max-w-xl">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                    <FiUser size={32} />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Welcome to Aamba</h1>
                <p className="text-slate-500 text-base md:text-lg leading-relaxed max-w-lg mx-auto">
                    Select your participation mode to access the decentralized microfinance marketplace.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                {/* Borrower */}
                <button
                    onClick={() => handleSelect('Borrower')}
                    disabled={!!selecting}
                    className="p-8 text-left rounded-3xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 disabled:opacity-60 group relative overflow-hidden bg-white border-slate-100 hover:border-purple-200"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 duration-500 opacity-60" />

                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-purple-50 text-purple-600 border border-purple-100 relative z-10 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                        <FiUser size={28} />
                    </div>

                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Borrower</h3>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            Apply for protocol-secured capital using your verified on-chain identity.
                        </p>

                        {selecting === 'Borrower' ? (
                            <div className="mt-6 flex items-center gap-2 text-purple-600">
                                <FiLoader className="animate-spin" size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Activating Profile...</span>
                            </div>
                        ) : (
                            <div className="mt-6 flex items-center gap-2 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold uppercase tracking-widest">Select Role</span>
                                <FiPlus size={14} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        )}
                    </div>
                </button>

                {/* Lender */}
                <button
                    onClick={() => handleSelect('Lender')}
                    disabled={!!selecting}
                    className="p-8 text-left rounded-3xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 disabled:opacity-60 group relative overflow-hidden bg-white border-slate-100 hover:border-blue-200"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 duration-500 opacity-60" />

                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-blue-50 text-blue-600 border border-blue-100 relative z-10 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        <FiTrendingUp size={28} />
                    </div>

                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Lender</h3>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            Deploy your capital into verified loan pools and earn cryptographically secured returns.
                        </p>

                        {selecting === 'Lender' ? (
                            <div className="mt-6 flex items-center gap-2 text-blue-600">
                                <FiLoader className="animate-spin" size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Activating Profile...</span>
                            </div>
                        ) : (
                            <div className="mt-6 flex items-center gap-2 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold uppercase tracking-widest">Select Role</span>
                                <FiPlus size={14} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        )}
                    </div>
                </button>
            </div>
        </div>
    );
};

// ---------- Main Dashboard ----------
const Dashboard = () => {
    const { userProfile, updateRole } = useAuth();

    const handleRoleSelect = async (role) => {
        try {
            await updateRole(role);
            toast.success(`Role set to ${role}. Welcome!`);
        } catch (err) {
            console.error('[Dashboard] Role update failed:', err);
            toast.error('Failed to set role. Please try again.');
        }
    };

    // Auth context still loading
    if (!userProfile) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin" style={{ borderTopColor: '#2563EB' }} />
                <span className="text-sm text-text-secondary font-medium">Loading profile...</span>
            </div>
        );
    }

    // Role properly set
    if (userProfile.role === 'Lender') {
        return (
            <>
                <InsurancePoolWidget />
                <LenderDashboard />
            </>
        );
    }
    if (userProfile.role === 'Borrower') {
        return (
            <>
                <InsurancePoolWidget />
                <BorrowerDashboard />
            </>
        );
    }

    // Role is 'Unassigned' or missing — show role picker
    return <RoleSelector onSelect={handleRoleSelect} />;
};

export default Dashboard;
