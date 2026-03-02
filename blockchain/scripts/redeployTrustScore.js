const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("====================================================");
    console.log("  Redeploying TrustScoreRegistry (Added penalize)");
    console.log("====================================================");
    console.log("Deployer:", deployer.address);

    const addrPath = path.join(__dirname, "../deployedAddresses.json");
    let current = {};
    if (fs.existsSync(addrPath)) {
        current = JSON.parse(fs.readFileSync(addrPath, "utf8"));
    }

    const TrustScore = await hre.ethers.getContractFactory("TrustScoreRegistry");
    const trustScore = await TrustScore.deploy(deployer.address);
    await trustScore.waitForDeployment();
    const tsAddress = await trustScore.getAddress();

    console.log("✅ New TrustScoreRegistry deployed to:", tsAddress);

    // Update deployedAddresses.json
    current.trustScore = tsAddress;
    fs.writeFileSync(addrPath, JSON.stringify(current, null, 2));
    console.log("📄 Updated: deployedAddresses.json");

    // Sync ABI to frontend and backend
    const artifactPath = path.join(__dirname, "../artifacts/contracts/TrustScoreRegistry.sol/TrustScoreRegistry.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const frontendAbiPath = path.join(__dirname, "../../frontend/src/contracts/TrustScoreRegistry.json");
    fs.writeFileSync(frontendAbiPath, JSON.stringify({ abi: artifact.abi }, null, 2));

    const backendAbiPath = path.join(__dirname, "../../backend/contracts/TrustScoreRegistry.json");
    fs.writeFileSync(backendAbiPath, JSON.stringify(artifact.abi, null, 2));

    console.log("📄 Synced ABI to frontend and backend");
    console.log("\nRun deployFactory.js and redeployMicrofinance.js to wire everything up!");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
