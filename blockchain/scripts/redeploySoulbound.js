/**
 * redeploySoulbound.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fresh deployment of SoulboundIdentity.sol to Sepolia.
 *
 * No logic changes. No constructor param changes. Deploy-only.
 *
 * After deployment this script:
 *  1. Updates blockchain/deployedAddresses.json
 *  2. Updates backend/contracts/addresses.json
 *  3. Updates frontend/src/contracts/addresses.json
 *  4. Syncs SoulboundIdentity ABI to frontend and backend
 *  5. Attempts Etherscan verification (non-blocking)
 *
 * Usage:
 *   npx hardhat run scripts/redeploySoulbound.js --network sepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("====================================================");
    console.log("🔁 Redeploying SoulboundIdentity — Sepolia");
    console.log("====================================================");
    console.log("Deployer:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
    console.log("====================================================\n");

    // ─── 1. Deploy ────────────────────────────────────────────────────────────
    console.log("📦 Deploying SoulboundIdentity...");
    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    const identity = await SoulboundIdentity.deploy(deployer.address);
    await identity.waitForDeployment();
    const newAddress = await identity.getAddress();
    const deployTx = identity.deploymentTransaction();

    console.log("✅ SoulboundIdentity deployed to:", newAddress);
    console.log("   TX Hash:", deployTx?.hash || "N/A");
    console.log("   Etherscan: https://sepolia.etherscan.io/address/" + newAddress + "\n");

    // ─── 2. Update blockchain/deployedAddresses.json ─────────────────────────
    const blockchainAddrPath = path.join(__dirname, "../deployedAddresses.json");
    let blockchainAddresses = {};
    if (fs.existsSync(blockchainAddrPath)) {
        blockchainAddresses = JSON.parse(fs.readFileSync(blockchainAddrPath, "utf8"));
    }
    const OLD_ADDRESS = blockchainAddresses.identity || "(none)";
    blockchainAddresses.identity = newAddress;
    fs.writeFileSync(blockchainAddrPath, JSON.stringify(blockchainAddresses, null, 2));
    console.log("📄 blockchain/deployedAddresses.json updated");
    console.log("   OLD:", OLD_ADDRESS, "→ NEW:", newAddress);

    // ─── 3. Update backend/contracts/addresses.json ───────────────────────────
    const backendAddrPath = path.join(__dirname, "../../backend/contracts/addresses.json");
    if (fs.existsSync(backendAddrPath)) {
        const backendAddresses = JSON.parse(fs.readFileSync(backendAddrPath, "utf8"));
        backendAddresses.identity = newAddress;
        fs.writeFileSync(backendAddrPath, JSON.stringify(backendAddresses, null, 2));
        console.log("📄 backend/contracts/addresses.json updated");
    } else {
        console.warn("⚠️  backend/contracts/addresses.json not found — skipped");
    }

    // ─── 4. Update frontend/src/contracts/addresses.json ─────────────────────
    const frontendAddrPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    if (fs.existsSync(frontendAddrPath)) {
        let raw = fs.readFileSync(frontendAddrPath, "utf8");
        // Parse carefully — the file may have duplicate keys; we normalise it here
        const parsed = JSON.parse(raw);
        parsed.identity = newAddress;
        // Write back a clean, deduplicated version
        const clean = {
            identity: parsed.identity,
            microfinance: parsed.microfinance,
            trustScore: parsed.trustScore,
            loanFactory: parsed.loanFactory,
            treasury: parsed.treasury,
            mockUSDT: parsed.mockUSDT,
            network: "sepolia",
            chainId: 11155111,
        };
        fs.writeFileSync(frontendAddrPath, JSON.stringify(clean, null, 2));
        console.log("📄 frontend/src/contracts/addresses.json updated");
    } else {
        console.warn("⚠️  frontend/src/contracts/addresses.json not found — skipped");
    }

    // ─── 5. Sync ABI to frontend + backend ───────────────────────────────────
    const artifactPath = path.join(
        __dirname,
        "../artifacts/contracts/SoulboundIdentity.sol/SoulboundIdentity.json"
    );
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

        const frontendAbiDest = path.join(__dirname, "../../frontend/src/contracts/SoulboundIdentity.json");
        fs.writeFileSync(frontendAbiDest, JSON.stringify({ abi: artifact.abi }, null, 2));
        console.log("📄 ABI synced → frontend/src/contracts/SoulboundIdentity.json");

        const backendAbiDest = path.join(__dirname, "../../backend/contracts/SoulboundIdentity.json");
        fs.writeFileSync(backendAbiDest, JSON.stringify(artifact.abi, null, 2));
        console.log("📄 ABI synced → backend/contracts/SoulboundIdentity.json");
    } else {
        console.warn("⚠️  Compiled artifact not found — ABI sync skipped. Run `npx hardhat compile` first.");
    }

    // ─── 6. Etherscan Verification (non-blocking) ────────────────────────────
    console.log("\n🔍 Waiting 30 s for Etherscan to index the contract...");
    await new Promise(r => setTimeout(r, 30000));

    try {
        console.log("🔍 Verifying on Etherscan...");
        await hre.run("verify:verify", {
            address: newAddress,
            constructorArguments: [deployer.address],
        });
        console.log("✅ Etherscan verification successful!");
    } catch (verifyErr) {
        if (verifyErr.message.toLowerCase().includes("already verified")) {
            console.log("✅ Contract already verified (identical bytecode).");
        } else {
            console.warn("⚠️  Verification warning (non-fatal):", verifyErr.message);
            console.log("   You can verify manually:");
            console.log(`   npx hardhat verify --network sepolia ${newAddress} "${deployer.address}"`);
        }
    }

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log("\n====================================================");
    console.log("🎉 SOULBOUND IDENTITY REDEPLOYMENT COMPLETE");
    console.log("----------------------------------------------------");
    console.log("  New Address:  ", newAddress);
    console.log("  Old Address:  ", OLD_ADDRESS);
    console.log("  Deployer:     ", deployer.address);
    console.log("  Network:       Sepolia (11155111)");
    console.log("  TX Hash:      ", deployTx?.hash || "N/A");
    console.log("  Etherscan:     https://sepolia.etherscan.io/address/" + newAddress);
    console.log("====================================================");
    console.log("\nFiles updated:");
    console.log("  ✅ blockchain/deployedAddresses.json");
    console.log("  ✅ backend/contracts/addresses.json");
    console.log("  ✅ frontend/src/contracts/addresses.json");
    console.log("  ✅ SoulboundIdentity ABI (frontend + backend)");
    console.log("\n⚠️  NEXT STEP: Restart the backend server to pick up the new address.");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Deployment failed:", err);
        process.exit(1);
    });
