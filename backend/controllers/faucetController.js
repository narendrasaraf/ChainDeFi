const { ethers } = require('ethers');
const User = require('../models/User');
const addressConfig = require('../contracts/addresses.json');
const _tUSDTAbi = require('../contracts/MockUSDT.json');
const tUSDTAbi = Array.isArray(_tUSDTAbi) ? _tUSDTAbi : _tUSDTAbi.abi;

const claimFaucet = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (!user.walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address not found in profile' });
        }

        if (user.hasClaimedFaucet) {
            return res.status(400).json({ success: false, error: 'Faucet already claimed' });
        }

        const maxRetries = 2;
        let success = false;
        let txHash = '';

        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        if (!addressConfig.mockUSDT) {
            return res.status(500).json({ success: false, error: 'tUSDT contract address not configured' });
        }

        const tokenContract = new ethers.Contract(addressConfig.mockUSDT, tUSDTAbi, wallet);
        const amount = ethers.parseUnits('1000', 6);

        for (let i = 0; i <= maxRetries; i++) {
            try {
                const tx = await tokenContract.mint(user.walletAddress, amount);
                const receipt = await tx.wait();
                txHash = receipt.hash;
                success = true;
                break;
            } catch (error) {
                console.error(`[Faucet] Attempt ${i + 1} failed for user ${user.walletAddress}:`, error.message);
                if (i === maxRetries) {
                    throw error;
                }
                // Wait 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (success) {
            user.hasClaimedFaucet = true;
            await user.save();

            // Log purely JSON formatted event as requested
            console.log(JSON.stringify({
                event: "FaucetMint",
                user: user.walletAddress,
                amount: 1000,
                txHash: txHash
            }));

            return res.status(200).json({
                success: true,
                message: '1000 tUSDT credited to your wallet',
                txHash
            });
        }

    } catch (error) {
        console.error('[Faucet] Claim error:', error);
        return res.status(500).json({ success: false, error: 'Failed to process faucet claim. Please try again later.' });
    }
};

module.exports = {
    claimFaucet
};
