const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // 1. Read existing deployments
    const addrPath = path.join(__dirname, "../deployedAddresses.json");
    if (!fs.existsSync(addrPath)) {
        throw new Error("deployedAddresses.json not found!");
    }
    const addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));
    const usdtAddress = addresses.mockUSDT;

    if (!usdtAddress) {
        throw new Error("mockUSDT address not found in deployedAddresses.json!");
    }

    // 2. Who is minting?
    const [deployer] = await hre.ethers.getSigners();

    // The recipient: You can pass an argument like: npx hardhat run scripts/mintUSDT.js --network sepolia
    // If you want a specific wallet, change the string below, otherwise it defaults to the deployer.
    const recipient = process.env.MINT_TO || deployer.address;

    // Amount to mint: 10,000 tUSDT
    const amountToMint = hre.ethers.parseUnits("10000", 6);

    console.log("====================================================");
    console.log(`  Minting tUSDT Faucet`);
    console.log(`  Contract : ${usdtAddress}`);
    console.log(`  Recipient: ${recipient}`);
    console.log(`  Amount   : 10,000 tUSDT`);
    console.log("====================================================");

    // 3. Connect to MockUSDT contract
    const MockUSDT = await hre.ethers.getContractAt("MockUSDT", usdtAddress);

    // 4. Call the public mint() function!
    console.log("Tx broadcasting...");
    const tx = await MockUSDT.mint(recipient, amountToMint);

    const receipt = await tx.wait();
    console.log(`✅ Success! Minted 10,000 tUSDT to ${recipient}`);
    console.log(`View on Explorer: https://sepolia.etherscan.io/tx/${receipt.hash}`);

    // Also show current balance
    const newBalance = await MockUSDT.balanceOf(recipient);
    console.log(`💳 New Balance  : ${hre.ethers.formatUnits(newBalance, 6)} tUSDT`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
