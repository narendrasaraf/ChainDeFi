import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiLoader, FiArrowLeft, FiShield, FiArrowRight, FiCheckCircle, FiKey } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { checkIdentityOwnership } from '../blockchainService';
import toast from 'react-hot-toast';
import axios from 'axios';

const SignIn = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, userProfile } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Cooldown timer logic
    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleSendOTP = async () => {
        if (!email) return toast.error('Enter email first');
        setLoading(true);
        const tid = toast.loading('Sending security code...');
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/send-otp`, { email });
            if (response.data.success) {
                toast.success('OTP sent to your email', { id: tid });
                setShowOTP(true);
                setResendCooldown(30);
            } else {
                toast.error(response.data.message || 'Failed to send OTP', { id: tid });
            }
        } catch (err) {
            toast.error('Service unavailable. Try again.', { id: tid });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length !== 6) return toast.error('Enter 6-digit code');
        setLoading(true);
        const tid = toast.loading('Verifying code...');
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/verify-otp`, { email, otp });
            if (response.data.verified) {
                toast.success('Aadhar Card Number Verified!', { id: tid });
                setEmailVerified(true);
            } else {
                toast.error(response.data.message || 'Invalid code', { id: tid });
            }
        } catch (err) {
            toast.error('Verification failed', { id: tid });
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!emailVerified) {
            return toast.error('Please verify your email with OTP first.');
        }

        setLoading(true);
        const tid = toast.loading('Signing you in...');
        try {
            const result = await login(email, password);
            if (result.success) {
                toast.success('Signed in successfully!', { id: tid });

                // Check if they need onboarding or can go to dashboard
                // A user is fully onboarded if their KYC status is 'Verified' in the database
                const profile = result.user || userProfile;

                // Also check if they have a wallet address and soulbound token on-chain
                const walletAddress = profile?.walletAddress || localStorage.getItem('walletAddress');

                let isOnboarded = profile?.kycStatus === 'Verified';

                // If DB says not verified but we have a wallet, double check on-chain just in case
                if (!isOnboarded && walletAddress) {
                    toast.loading('Checking on-chain Soulbound ID...', { id: tid });
                    try {
                        // 5s timeout for sign-in check to prevent hanging
                        isOnboarded = await checkIdentityOwnership(walletAddress, null, 5000);
                    } catch (rpcErr) {
                        console.warn("[SignIn] On-chain check failed/timed out, continuing with DB state.");
                    }
                }

                if (isOnboarded) {
                    localStorage.setItem("isOnboarded", "true");
                    navigate('/dashboard');
                } else {
                    localStorage.removeItem("isOnboarded");
                    navigate('/onboarding');
                }
            } else {
                toast.error(result.message || 'Login failed', { id: tid });
            }
        } catch (err) {
            toast.error('Connection error.', { id: tid });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 md:px-6 relative" style={{ backgroundColor: '#FFFFFF' }}>
            <button
                onClick={() => navigate('/')}
                className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors group"
            >
                <FiArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Home
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                        style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                        <FiShield size={24} style={{ color: '#2563EB' }} />
                    </div>
                    <h2 className="text-2xl font-bold text-text-primary mb-1.5">Welcome back</h2>
                    <p className="text-sm text-text-secondary">Sign in to your PanCred account</p>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl p-7 md:p-8" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1.5">Email Address</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                                    <input
                                        type="email"
                                        required
                                        disabled={emailVerified}
                                        className="form-input pl-10"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
                                <div className="relative">
                                    <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                                    <input
                                        type="password"
                                        required
                                        className="form-input pl-10"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {!showOTP && !emailVerified && (
                                <button
                                    type="button"
                                    onClick={handleSendOTP}
                                    disabled={loading}
                                    className="btn-primary w-full"
                                >
                                    {loading ? <FiLoader className="animate-spin" size={16} /> : <><FiKey size={16} /> Send Verification Code</>}
                                </button>
                            )}
                        </div>

                        {/* OTP Entry */}
                        {showOTP && !emailVerified && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-1">
                                <div className="text-center">
                                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Verification Code</p>
                                    <p className="text-sm text-text-secondary">Sent to <span className="font-medium text-text-primary">{email}</span></p>
                                </div>
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="000000"
                                    className="form-input text-2xl font-mono tracking-[0.5em] text-center"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowOTP(false)}
                                        className="btn-ghost !py-2.5 text-sm"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleVerifyOTP}
                                        disabled={loading}
                                        className="btn-primary !py-2.5 text-sm"
                                    >
                                        {loading ? <FiLoader className="animate-spin" size={14} /> : 'Verify'}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Verified state */}
                        {emailVerified && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                <div className="flex items-center gap-3 p-3.5 rounded-xl"
                                    style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                    <FiCheckCircle style={{ color: '#16A34A' }} size={18} className="flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: '#16A34A' }}>Email Verified</p>
                                        <p className="text-xs text-text-secondary truncate">{email}</p>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary w-full !py-3.5"
                                >
                                    {loading ? <FiLoader className="animate-spin" size={16} /> : <>Sign In <FiArrowRight size={16} /></>}
                                </button>
                            </motion.div>
                        )}
                    </form>

                    <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <p className="text-sm text-text-secondary">
                            Don't have an account?{' '}
                            <button onClick={() => navigate('/signup')} className="font-semibold ml-1 transition-colors" style={{ color: '#2563EB' }}>
                                Create Account
                            </button>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default SignIn;
