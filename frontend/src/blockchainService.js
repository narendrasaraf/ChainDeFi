import { ethers } from 'ethers';
import addresses from './contracts/addresses.json';

const IdentityABI = [
    "function mintIdentity() external",
    "function balanceOf(address owner) view returns (uint256)",
    "error Soulbound_AlreadyHasIdentity()"
];

const IDENTITY_CONTRACT_ADDRESS = addresses.identity;
const DEFAULT_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const RPC_URL = import.meta.env.VITE_RPC_URL || DEFAULT_RPC;

// Shared provider instance to prevent redundant connections
let sharedProvider = null;

export const getSharedProvider = () => {
    if (!sharedProvider) {
        sharedProvider = new ethers.JsonRpcProvider(RPC_URL);
    }
    return sharedProvider;
};

/**
 * Helper to wrap a promise with a timeout
 */
const withTimeout = (promise, ms = 8000, timeoutMsg = "Network timeout") => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMsg)), ms)
        )
    ]);
};

/**
 * Reads the total number of Soulbound Identity NFTs minted on-chain.
 */
export const getSBTCount = async () => {
    try {
        const provider = getSharedProvider();
        // Storage slot 7 = _nextTokenId
        const raw = await withTimeout(provider.getStorage(IDENTITY_CONTRACT_ADDRESS, 7), 5000);
        const nextTokenId = parseInt(raw, 16);
        const total = nextTokenId > 0 ? nextTokenId - 1 : 0;
        console.log(`[Blockchain] SBT total minted: ${total} (nextTokenId=${nextTokenId})`);
        return total;
    } catch (err) {
        console.error("[Blockchain] getSBTCount failed:", err);
        return null;
    }
};

export const getBlockchainSigner = async () => {
    if (!window.ethereum) throw new Error("MetaMask not found.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return signer;
};

export const getIdentityContract = async (signer) => {
    return new ethers.Contract(
        IDENTITY_CONTRACT_ADDRESS,
        IdentityABI,
        signer
    );
};

export const mintIdentity = async (signer, onSent) => {
    if (!signer) throw new Error("No signer provided");

    const identityContract = new ethers.Contract(
        IDENTITY_CONTRACT_ADDRESS,
        IdentityABI,
        signer
    );

    const userAddr = await signer.getAddress();

    // 1. Verify we are on Sepolia (ChainID 11155111)
    const network = await signer.provider.getNetwork();
    if (network.chainId !== 11155111n && network.chainId !== 11155111) {
        throw new Error(`Incorrect Network: Please switch your wallet to Sepolia (Current Chain ID: ${network.chainId})`);
    }

    // 2. Verify contract code exists
    const code = await signer.provider.getCode(IDENTITY_CONTRACT_ADDRESS);
    if (code === "0x" || code === "0x0") {
        throw new Error("Identity Contract not found at configured address on Sepolia. Please verify deployment.");
    }

    console.log("[Blockchain] Checking if identity already exists for:", userAddr);
    const balance = await identityContract.balanceOf(userAddr);
    if (balance > 0n) {
        console.log("[Blockchain] Identity already exists. Skipping mint.");
        return {
            alreadyExists: true,
            address: userAddr
        };
    }

    console.log("[Blockchain] Initiating Identity Mint to contract:", IDENTITY_CONTRACT_ADDRESS);
    try {
        // We use estimateGas explicitly to catch the revert reason early if possible
        try {
            await identityContract.mintIdentity.estimateGas();
        } catch (gasErr) {
            console.warn("[Blockchain] Gas estimation failed, transaction will likely revert:", gasErr);
            if (gasErr.message.includes("Soulbound_AlreadyHasIdentity") || gasErr.message.includes("AlreadyHasIdentity")) {
                throw new Error("This wallet already owns a Soulbound Identity.");
            }
        }

        const tx = await identityContract.mintIdentity();
        console.log("[Blockchain] Mint transaction sent:", tx.hash);
        console.log("[Blockchain] Transaction 'to' address:", tx.to);

        if (onSent) onSent(tx.hash);

        const receipt = await tx.wait();
        console.log("[Blockchain] Mint confirmed in block:", receipt.blockNumber);

        return {
            receipt,
            txHash: tx.hash,
            address: userAddr
        };
    } catch (err) {
        if (err.message.includes("Soulbound_AlreadyHasIdentity")) {
            return { alreadyExists: true, address: userAddr };
        }
        console.error("[Blockchain] Minting error:", err);
        throw err;
    }
};

export const checkIdentityOwnership = async (userAddress, customProvider = null, timeoutMs = 8000) => {
    if (!userAddress) return false;
    try {
        // Use custom provider (e.g. from wallet) if available for better sync
        const provider = customProvider || getSharedProvider();

        // Wrap the network calls in a timeout to prevent hanging UI
        const check = async () => {
            // 1. Verify code exists at the address to prevent decoding errors
            const code = await provider.getCode(IDENTITY_CONTRACT_ADDRESS);
            if (code === "0x" || code === "0x0") {
                console.warn("[Blockchain] No contract code found at Identity address on Sepolia.");
                return false;
            }

            const identityContract = new ethers.Contract(
                IDENTITY_CONTRACT_ADDRESS,
                IdentityABI,
                provider
            );
            const balance = await identityContract.balanceOf(userAddress);
            console.log(`[Blockchain] Identity Check for ${userAddress}: Balance = ${balance}`);
            return balance > 0n;
        };

        return await withTimeout(check(), timeoutMs, "Blockchain node is slow or rate-limited. Skipping on-chain check.");
    } catch (error) {
        console.warn("[Blockchain] Ownership check failed or timed out:", error.message);
        return false;
    }
};
export const parseBlockchainError = (error) => {
    if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected')) {
        return "Transaction cancelled by user.";
    }
    if (error.message?.includes('insufficient funds')) {
        return "Insufficient Sepolia ETH for gas + value.";
    }
    if (error.message?.includes('missing revert data')) {
        return "Protocol Reverted: Likely identity verification failed or contract out of sync. Please ensure you have minted your Identity NFT.";
    }
    if (error.reason) return error.reason;
    return error.message || "An unexpected blockchain error occurred.";
};
