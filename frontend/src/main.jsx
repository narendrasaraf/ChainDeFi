import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import '@rainbow-me/rainbowkit/styles.css';
import {
    RainbowKitProvider,
    darkTheme,
    getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, sepolia, polygon, optimism, arbitrum, base } from 'wagmi/chains';

import {
    QueryClientProvider,
    QueryClient,
} from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';

import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

// ── AWS Amplify (for Face Liveness guest credentials) ──────────────────────
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
Amplify.configure({
    Auth: {
        Cognito: {
            identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
            allowGuestAccess: true,
            identityPoolRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        },
    },
// 
    
});

// Use getDefaultConfig WITHOUT a custom wallets array — let RainbowKit
// handle its own wallet detection. This avoids the 'b is not a function'
// crash caused by incorrect wallet factory signatures in production builds.
const config = getDefaultConfig({
    appName: 'MicroFin',
    projectId: 'b1eef86bafdfb9db1124deb507c6e076',
    chains: [sepolia, mainnet, polygon, optimism, arbitrum, base],
});

const queryClient = new QueryClient();

import { Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <RainbowKitProvider theme={darkTheme({
                        accentColor: '#2563eb',
                        accentColorForeground: 'white',
                        borderRadius: 'large',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}>
                        <Toaster position="top-right" toastOptions={{
                            style: {
                                background: '#ffffff',
                                color: '#1e293b',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: '500',
                                padding: '12px 16px',
                            },
                            success: { style: { borderLeft: '4px solid #16a34a' } },
                            error: { style: { borderLeft: '4px solid #dc2626' } },
                            loading: { style: { borderLeft: '4px solid #2563eb' } },
                        }} />
                        <App />
                    </RainbowKitProvider>
                </AuthProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </StrictMode>,
)
