import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiHome,
    FiTrendingUp,
    FiDownload,
    FiUser,
    FiLogOut,
    FiHelpCircle,
    FiShield,
    FiX
} from 'react-icons/fi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const Sidebar = ({ onClose }) => {
    const { logout, userProfile } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
        if (onClose) onClose();
    };

    const handleLinkClick = () => {
        if (onClose) onClose();
    };

    return (
        <aside
            className="w-[240px] h-screen flex flex-col pt-6 pb-5 px-3 overflow-hidden"
            style={{ backgroundColor: '#FFFFFF', borderRight: '1px solid #E2E8F0' }}
        >
            {/* Brand */}
            <div className="flex items-center justify-between mb-8 px-2 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2563EB' }}>
                        <FiShield className="text-white" size={15} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-text-primary leading-tight">PanCred</h1>
                        <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Microfinance</p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-all"
                    >
                        <FiX size={16} />
                    </button>
                )}
            </div>

            {/* Navigation — scrollable if content overflows */}
            <nav className="flex-1 space-y-0.5 overflow-y-auto min-h-0">
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-3 mb-2">Navigation</p>

                <NavLink to="/dashboard" onClick={handleLinkClick} end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <FiHome size={16} /> Dashboard
                </NavLink>

                {userProfile?.role === 'Lender' && (
                    <NavLink to="/lend" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <FiTrendingUp size={16} /> Lend Capital
                    </NavLink>
                )}

                {userProfile?.role === 'Borrower' && (
                    <NavLink to="/borrow" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <FiDownload size={16} /> Borrow Assets
                    </NavLink>
                )}

                <NavLink to="/dashboard/profile" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <FiUser size={16} /> My Profile
                </NavLink>

                <div className="pt-5">
                    <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-3 mb-2">Support</p>
                    <NavLink to="/how-it-works" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <FiHelpCircle size={16} /> How it Works
                    </NavLink>
                </div>
            </nav>

            {/* Bottom: Wallet + Logout — always visible, never pushed off screen */}
            <div className="shrink-0 pt-4 space-y-2" style={{ borderTop: '1px solid #E2E8F0' }}>
                <div className="px-1 overflow-hidden flex justify-center py-1">
                    <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-red-600 hover:bg-red-50 transition-all duration-150"
                >
                    <FiLogOut size={16} /> Sign Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
