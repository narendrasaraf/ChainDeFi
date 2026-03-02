import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { FiMenu, FiX, FiUser, FiLogOut, FiLayout, FiArrowRight, FiShield } from 'react-icons/fi';

const Navbar = () => {
    const { isAuthenticated, userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
        setIsMenuOpen(false);
    };

    return (
        <nav style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} className="sticky top-0 z-50">
            <div className="global-container h-16 flex justify-between items-center">
                {/* Brand */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2563EB' }}>
                        <FiShield className="text-white" size={16} />
                    </div>
                    <Link to="/" className="text-lg font-bold text-text-primary tracking-tight">
                        PanCred
                    </Link>
                </div>

                {/* Desktop Menu */}
                <div className="hidden lg:flex items-center gap-8">
                    <div className="flex items-center gap-6">
                        <Link to="/dashboard" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                            Dashboard
                        </Link>
                        {userProfile?.role === 'Lender' && (
                            <Link to="/lend" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                                Lend
                            </Link>
                        )}
                        {userProfile?.role === 'Borrower' && (
                            <Link to="/borrow" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                                Borrow
                            </Link>
                        )}
                    </div>

                    <div className="flex items-center gap-4 pl-6" style={{ borderLeft: '1px solid #E2E8F0' }}>
                        {isAuthenticated ? (
                            <div className="flex items-center gap-3">
                                <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
                                <Link
                                    to="/dashboard/profile"
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-all"
                                    title="Profile"
                                >
                                    <FiUser size={17} />
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-red-600 hover:bg-red-50 transition-all"
                                    title="Sign Out"
                                >
                                    <FiLogOut size={17} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Link to="/signin" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2">
                                    Sign In
                                </Link>
                                <Link to="/signup" className="btn-primary !px-5 !py-2.5 text-sm">
                                    Get Started <FiArrowRight size={14} />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Toggle */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-all"
                >
                    {isMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }} className="lg:hidden py-5 px-4 space-y-1">
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-slate-50 transition-all">
                        <FiLayout size={16} /> Dashboard
                    </Link>
                    {userProfile?.role === 'Lender' && (
                        <Link to="/lend" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-slate-50 transition-all">
                            <FiLayout size={16} /> Lend
                        </Link>
                    )}
                    {userProfile?.role === 'Borrower' && (
                        <Link to="/borrow" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-slate-50 transition-all">
                            <FiLayout size={16} /> Borrow
                        </Link>
                    )}

                    <div className="pt-4 mt-4" style={{ borderTop: '1px solid #E2E8F0' }}>
                        {isAuthenticated ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-3">
                                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Wallet</span>
                                    <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Link to="/dashboard/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-text-primary border border-border hover:bg-slate-50 transition-all">
                                        <FiUser size={15} /> Profile
                                    </Link>
                                    <button onClick={handleLogout} className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 transition-all">
                                        <FiLogOut size={15} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Link to="/signin" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center py-2.5 text-sm font-medium text-text-primary border border-border rounded-lg hover:bg-slate-50 transition-all">
                                    Sign In
                                </Link>
                                <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="btn-primary w-full justify-center">
                                    Get Started <FiArrowRight size={14} />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
