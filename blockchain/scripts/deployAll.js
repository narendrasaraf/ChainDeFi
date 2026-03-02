const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("====================================================");
    console.log(`🚀 Starting Deployment to ${hre.network.name}`);
    console.log("Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance));
    console.log("====================================================");

    // 1. Deploy SoulboundIdentity
    console.log("\n📦 Deploying SoulboundIdentity...");
    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    const identity = await SoulboundIdentity.deploy(deployer.address);
    await identity.waitForDeployment();
    const identityAddress = await identity.getAddress();
    console.log("✅ SoulboundIdentity deployed to:", identityAddress);

    // 2. Deploy TrustScoreRegistry
    console.log("\n📦 Deploying TrustScoreRegistry...");
    const TrustScoreRegistry = await hre.ethers.getContractFactory("TrustScoreRegistry");
    const trustRegistry = await TrustScoreRegistry.deploy(deployer.address);
    await trustRegistry.waitForDeployment();
    const trustRegistryAddress = await trustRegistry.getAddress();
    console.log("✅ TrustScoreRegistry deployed to:", trustRegistryAddress);

    // 3. Deploy Microfinance (Loan Contract)
    console.log("\n📦 Deploying Microfinance...");
    const Microfinance = await hre.ethers.getContractFactory("Microfinance");
    const microfinance = await Microfinance.deploy(identityAddress, trustRegistryAddress);
    await microfinance.waitForDeployment();
    const microfinanceAddress = await microfinance.getAddress();
    console.log("✅ Microfinance deployed to:", microfinanceAddress);

    // 4. Authorize Microfinance in TrustScoreRegistry
    console.log("\n🔐 Authorizing Microfinance in TrustScoreRegistry...");
    const authTx = await trustRegistry.setAuthorized(microfinanceAddress, true);
    await authTx.wait();
    console.log("✅ Authorization complete.");

    console.log("\n====================================================");
    console.log("🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY");
    console.log("----------------------------------------------------");
    console.log("Identity Contract:  ", identityAddress);
    console.log("Loan Contract:      ", microfinanceAddress);
    console.log("Trust Score Contract:", trustRegistryAddress);
    console.log("====================================================");

    // Save addresses to a file for frontend/backend integration
    const addresses = {
        identity: identityAddress,
        microfinance: microfinanceAddress,
        trustScore: trustRegistryAddress,
        network: hre.network.name,
        chainId: hre.network.config.chainId
    };

    const addressesPath = path.join(__dirname, "../deployedAddresses.json");
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`\n📄 Addresses saved to: ${addressesPath}`);
}

// Global error handling for the deployment process
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed!");
        console.error(error);
        process.exit(1);
    });

