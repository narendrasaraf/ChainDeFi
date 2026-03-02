import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiArrowRight, FiShield, FiCheckCircle, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localLoading, setLocalLoading] = useState(false);

    // OTP Related States
    const [showOTP, setShowOTP] = useState(false);
    const [otp, setOtp] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const { register } = useAuth();
    const navigate = useNavigate();

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
        setLocalLoading(true);
        const tid = toast.loading('Sending verification code...');
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/send-otp`, { email });
            if (response.data.success) {
                toast.success('Code sent to your email', { id: tid });
                setShowOTP(true);
                setResendCooldown(30);
            } else {
                toast.error(response.data.message || 'Failed to send code', { id: tid });
            }
        } catch (err) {
            toast.error('Service unavailable. Try again.', { id: tid });
        } finally {
            setLocalLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length !== 6) return toast.error('Enter 6-digit code');

        setLocalLoading(true);
        const tid = toast.loading('Verifying code...');
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/verify-otp`, { email, otp });
            if (response.data.verified) {
                toast.success('Email verified!', { id: tid });
                setEmailVerified(true);
            } else {
                toast.error(response.data.message || 'Invalid code', { id: tid });
            }
        } catch (err) {
            toast.error('Verification failed', { id: tid });
        } finally {
            setLocalLoading(false);
        }
    };

    const handleResendOTP = () => {
        if (resendCooldown === 0) {
            handleSendOTP();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!emailVerified) {
            await handleSendOTP();
            return;
        }

        setLocalLoading(true);
        const tid = toast.loading('Creating your account...');

        try {
            const result = await register(name, email, password);
            if (result.success) {
                toast.success('Account created!', { id: tid });

                // If they registered with an email that already had a complete profile
                const profile = result.user;
                if (profile?.kycStatus === 'Verified') {
                    localStorage.setItem("isOnboarded", "true");
                    navigate('/dashboard');
                } else {
                    localStorage.removeItem("isOnboarded");
                    navigate('/onboarding');
                }
            } else {
                toast.error(result.message, { id: tid });
            }
        } catch (err) {
            toast.error('Registration failed. Check network.', { id: tid });
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative" style={{ backgroundColor: '#FFFFFF' }}>
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
                    <h1 className="text-2xl font-bold text-text-primary mb-1.5">Create your account</h1>
                    <p className="text-sm text-text-secondary">Join the PanCred decentralized finance network</p>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl p-7 md:p-8" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!showOTP && (
                            <AnimatePresence>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary mb-1.5">Full Name</label>
                                        <div className="relative">
                                            <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                                            <input
                                                type="text"
                                                required
                                                className="form-input pl-10"
                                                placeholder="John Doe"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-text-primary mb-1.5">Email Address</label>
                                        <div className="relative">
                                            <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                                            <input
                                                type="email"
                                                required
                                                className="form-input pl-10"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

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
                                </motion.div>
                            </AnimatePresence>
                        )}

                        {/* OTP Entry */}
                        {showOTP && !emailVerified && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 py-2">
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
                                        onClick={handleResendOTP}
                                        disabled={localLoading || resendCooldown > 0}
                                        className="btn-ghost !py-2.5 text-sm disabled:opacity-50"
                                    >
                                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleVerifyOTP}
                                        disabled={localLoading}
                                        className="btn-primary !py-2.5 text-sm"
                                    >
                                        {localLoading ? <FiLoader className="animate-spin" size={14} /> : 'Verify'}
                                    </button>
                                </div>
                                <button type="button" onClick={() => setShowOTP(false)} className="w-full text-xs font-medium text-text-secondary hover:text-text-primary transition-all text-center">
                                    ← Change Email Address
                                </button>
                            </motion.div>
                        )}

                        {/* Email verified badge */}
                        {emailVerified && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3.5 rounded-xl"
                                style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                <FiCheckCircle style={{ color: '#16A34A' }} size={18} className="flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: '#16A34A' }}>Email Verified</p>
                                    <p className="text-xs text-text-secondary truncate">{email}</p>
                                </div>
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={localLoading || (showOTP && !emailVerified)}
                            className="btn-primary w-full !py-3.5"
                        >
                            {localLoading ? (
                                <FiLoader className="animate-spin" size={16} />
                            ) : (
                                <>
                                    {emailVerified ? 'Create Account' : 'Send Verification Code'}
                                    <FiArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <p className="text-sm text-text-secondary">
                            Already have an account?{' '}
                            <Link to="/signin" className="font-semibold ml-1 transition-colors" style={{ color: '#2563EB' }}>
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-center gap-6 opacity-60">
                    <div className="flex items-center gap-1.5">
                        <FiShield size={12} style={{ color: '#2563EB' }} />
                        <span className="text-xs text-text-secondary font-medium">Encrypted</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#16A34A' }}></div>
                        <span className="text-xs text-text-secondary font-medium">Web3 Ready</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Signup;
