import { injected } from 'wagmi/connectors';
import { createConnector } from 'wagmi';

export const PanCredWallet = () => ({
    id: 'PanCred-custom-wallet',
    name: 'PanCred Smart Wallet',
    iconUrl: 'https://ui-avatars.com/api/?name=PanCred&background=3b82f6&color=fff',
    iconBackground: '#3b82f6',
    // Change to true once you have built your custom browser extension 
    // that injects `window.aamba` into the browser DOM
    installed: typeof window !== 'undefined' && typeof window.PanCred !== 'undefined',
    downloadUrls: {
        chrome: 'https://chrome.google.com/webstore/detail/your-custom-wallet',
        browserExtension: 'https://your-custom-wallet.com'
    },
    extension: {
        instructions: {
            learnMoreUrl: 'https://your-custom-wallet.com/learn-more',
            steps: [
                {
                    description: 'Install the PanCred Smart Wallet extension to interact with our protocol smart contracts.',
                    step: 'install',
                    title: 'Install Extension',
                },
                {
                    description: 'Refresh the browser to detect your new customized crypto wallet.',
                    step: 'refresh',
                    title: 'Refresh Browser',
                }
            ]
        }
    },
    createConnector: (walletDetails) => {
        const isOurWalletInstalled = typeof window !== 'undefined' && typeof window.PanCred !== 'undefined';

        // Proper Wagmi v2 custom connector wrapper
        return createConnector((config) => ({
            ...injected({
                target: isOurWalletInstalled ? {
                    id: 'PanCredProvider',
                    name: 'PanCred Smart Wallet',
                    provider: window.PanCred
                } : 'metaMask', // Fallback to standard injected provider for development testing
            })(config),
            ...walletDetails,
        }));
    },
});
