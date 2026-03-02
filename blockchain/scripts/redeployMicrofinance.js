const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const addrPath = path.join(__dirname, "../deployedAddresses.json");
    const current = JSON.parse(fs.readFileSync(addrPath, "utf8"));

    // Treasury = deployer by default. Change this to a multisig/separate wallet in production.
    const treasury = deployer.address;

    console.log("====================================================");
    console.log("  Redeploying Microfinance (fee + getAllLoans fix)");
    console.log("====================================================");
    console.log("Deployer          :", deployer.address);
    console.log("Identity address  :", current.identity);
    console.log("TrustScore address:", current.trustScore);
    console.log("Treasury address  :", treasury);
    console.log("Old Microfinance  :", current.microfinance);
    console.log("----------------------------------------------------");

    const Microfinance = await hre.ethers.getContractFactory("Microfinance");
    const microfinance = await Microfinance.deploy(current.identity, current.trustScore, treasury);
    await microfinance.waitForDeployment();
    const newAddress = await microfinance.getAddress();

    console.log("✅ New Microfinance deployed to:", newAddress);

    // Verify wiring
    const linkedIdentity = await microfinance.getIdentityAddress();
    const linkedTreasury = await microfinance.treasury();
    const feeBps = await microfinance.protocolFeeBasisPoints();
    console.log("🔗 Identity (on-chain) :", linkedIdentity);
    console.log("🏦 Treasury (on-chain) :", linkedTreasury);
    console.log("💰 Fee (basis points)  :", feeBps.toString(), "=", (Number(feeBps) / 100).toFixed(2) + "%");

    if (linkedIdentity.toLowerCase() !== current.identity.toLowerCase()) {
        console.error("❌ Identity MISMATCH — something went wrong.");
        process.exit(1);
    }
    console.log("✨ All wiring confirmed correct.");

    // Update deployedAddresses.json
    current.microfinance = newAddress;
    current.treasury = treasury;
    fs.writeFileSync(addrPath, JSON.stringify(current, null, 2));
    console.log("\n📄 Updated: blockchain/deployedAddresses.json");

    // Update frontend/src/contracts/addresses.json
    const frontendAddrPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    const frontendAddrs = JSON.parse(fs.readFileSync(frontendAddrPath, "utf8"));
    frontendAddrs.microfinance = newAddress;
    frontendAddrs.treasury = treasury;
    fs.writeFileSync(frontendAddrPath, JSON.stringify(frontendAddrs, null, 2));
    console.log("📄 Updated: frontend/src/contracts/addresses.json");

    // Update backend/contracts/addresses.json
    const backendAddrPath = path.join(__dirname, "../../backend/contracts/addresses.json");
    const backendAddrs = JSON.parse(fs.readFileSync(backendAddrPath, "utf8"));
    backendAddrs.microfinance = newAddress;
    backendAddrs.treasury = treasury;
    fs.writeFileSync(backendAddrPath, JSON.stringify(backendAddrs, null, 2));
    console.log("📄 Updated: backend/contracts/addresses.json");

    // Sync ABI to frontend (wrapped format)
    const artifactPath = path.join(__dirname, "../artifacts/contracts/Microfinance.sol/Microfinance.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const frontendAbiPath = path.join(__dirname, "../../frontend/src/contracts/Microfinance.json");
    fs.writeFileSync(frontendAbiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
    console.log("📄 Updated: frontend/src/contracts/Microfinance.json (ABI synced)");

    // Sync ABI to backend (flat array format)
    const backendAbiPath = path.join(__dirname, "../../backend/contracts/Microfinance.json");
    fs.writeFileSync(backendAbiPath, JSON.stringify(artifact.abi, null, 2));
    console.log("📄 Updated: backend/contracts/Microfinance.json (ABI synced)");

    console.log("\n====================================================");
    console.log("  DONE — New Microfinance:", newAddress);
    console.log("====================================================\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Redeployment failed:", err.message);
        process.exit(1);
    });
