import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useDisconnect } from 'wagmi';

const AuthContext = createContext();

export const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`
});

// Add a request interceptor to always attach the token
api.interceptors.request.use(
    (config) => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const { token } = JSON.parse(userInfo);
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                console.error("Failed to parse userInfo for interceptor", e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401s (token expire/invalid)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Skip global intercept redirect if the 401 came from login/register endpoints
        const originalRequest = error.config;
        if (originalRequest && (originalRequest.url.includes('/login') || originalRequest.url.includes('/register'))) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {
            console.warn("Unauthorized detected. Clearing session.");
            localStorage.removeItem('userInfo');
            localStorage.removeItem('isOnboarded');
            // We can't use navigate here because we are outside a component, 
            // but the App.jsx will detect isAuthenticated: false on next render
            window.location.href = '/signin';
        }
        return Promise.reject(error);
    }
);

export const AuthProvider = ({ children }) => {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const { disconnect } = useDisconnect();

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                setUserProfile(JSON.parse(userInfo));
            } catch (e) {
                console.error("Failed to parse userInfo in useEffect", e);
                localStorage.removeItem('userInfo');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            setLoading(true);
            const response = await api.post('/users/login', { email, password });
            if (response.data.success) {
                const data = response.data.data;
                setUserProfile(data);
                localStorage.setItem('userInfo', JSON.stringify(data));
                return { success: true, user: data };
            }
        } catch (error) {
            console.error("Login failed", error);
            return { success: false, message: error.response?.data?.message || 'Login failed' };
        } finally {
            setLoading(false);
        }
    };

    const walletLogin = async (walletAddress) => {
        try {
            setLoading(true);
            const response = await api.post('/users/wallet-login', { walletAddress });
            if (response.data.success) {
                const data = response.data.data;
                setUserProfile(data);
                localStorage.setItem('userInfo', JSON.stringify(data));
                return { success: true, user: data };
            }
        } catch (error) {
            console.error("Wallet login failed", error);
            return { success: false, message: 'Wallet login failed' };
        } finally {
            setLoading(false);
        }
    };

    const register = async (name, email, password) => {
        try {
            setLoading(true);
            const response = await api.post('/users/register', { name, email, password });
            if (response.data.success) {
                const data = response.data.data;
                setUserProfile(data);
                localStorage.setItem('userInfo', JSON.stringify(data));
                return { success: true, user: data };
            }
        } catch (error) {
            console.error("Registration failed", error);
            return { success: false, message: error.response?.data?.message || 'Registration failed' };
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        console.log("[Auth] Initiating session termination and wallet disconnection...");
        try {
            disconnect();
        } catch (e) {
            console.error("[Auth] Wallet disconnection failed during logout", e);
        }
        localStorage.removeItem('userInfo');
        localStorage.removeItem('isOnboarded');
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('userRole');
        setUserProfile(null);
        console.log("[Auth] Session cleared.");
    };

    const updateRole = async (role) => {
        if (!userProfile) return;
        try {
            const response = await api.put(`/users/role`, { role });
            if (response.data.success) {
                const data = response.data.data;
                setUserProfile(data);
                localStorage.setItem('userInfo', JSON.stringify(data));
            }
        } catch (err) {
            console.error("Update role failed", err);
        }
    }

    const submitKyc = async (documentType, documentNumber, image, walletAddress = null, txHash = null) => {
        if (!userProfile) return;
        try {
            const response = await api.post(`/users/kyc`, {
                documentType,
                documentNumber,
                image,
                walletAddress,
                txHash
            });

            if (response.data.success) {
                const data = response.data.data;
                setUserProfile(data);
                localStorage.setItem('userInfo', JSON.stringify(data));
                return true;
            }
        } catch (err) {
            console.error("KYC failed", err.response?.data || err);
            return false;
        }
    }

    return (
        <AuthContext.Provider value={{
            userProfile,
            loading,
            isAuthenticated: !!userProfile,
            login,
            walletLogin,
            register,
            logout,
            updateRole,
            submitKyc
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
