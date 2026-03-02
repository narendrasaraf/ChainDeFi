const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("====================================================");
    console.log("  Deploying MockUSDT (tUSDT) — Testnet ERC-20");
    console.log("====================================================");
    console.log("Deployer :", deployer.address);
    console.log("Network  :", hre.network.name);
    console.log("----------------------------------------------------");

    // Deploy MockUSDT
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    const address = await mockUSDT.getAddress();

    console.log("✅  MockUSDT deployed to:", address);

    // Verify initial state
    const deployerBalance = await mockUSDT.balanceOf(deployer.address);
    const decimals = await mockUSDT.decimals();
    const name = await mockUSDT.name();
    const symbol = await mockUSDT.symbol();

    console.log("\n📋  Token Details:");
    console.log("    Name    :", name);
    console.log("    Symbol  :", symbol);
    console.log("    Decimals:", decimals.toString());
    console.log(
        "    Deployer Balance:",
        hre.ethers.formatUnits(deployerBalance, decimals),
        symbol
    );

    // ── Update deployedAddresses.json (blockchain dir) ──────────────────────
    const addrPath = path.join(__dirname, "../deployedAddresses.json");
    const deployed = JSON.parse(fs.readFileSync(addrPath, "utf8"));
    deployed.mockUSDT = address;
    fs.writeFileSync(addrPath, JSON.stringify(deployed, null, 2));
    console.log("\n📄  Updated: blockchain/deployedAddresses.json");

    // ── Update frontend/src/contracts/addresses.json ─────────────────────────
    const frontendAddrPath = path.join(
        __dirname,
        "../../frontend/src/contracts/addresses.json"
    );
    if (fs.existsSync(frontendAddrPath)) {
        const frontendAddrs = JSON.parse(fs.readFileSync(frontendAddrPath, "utf8"));
        frontendAddrs.mockUSDT = address;
        fs.writeFileSync(frontendAddrPath, JSON.stringify(frontendAddrs, null, 2));
        console.log("📄  Updated: frontend/src/contracts/addresses.json");
    }

    // ── Update backend/contracts/addresses.json ───────────────────────────────
    const backendAddrPath = path.join(
        __dirname,
        "../../backend/contracts/addresses.json"
    );
    if (fs.existsSync(backendAddrPath)) {
        const backendAddrs = JSON.parse(fs.readFileSync(backendAddrPath, "utf8"));
        backendAddrs.mockUSDT = address;
        fs.writeFileSync(backendAddrPath, JSON.stringify(backendAddrs, null, 2));
        console.log("📄  Updated: backend/contracts/addresses.json");
    }

    // ── Sync ABI to frontend ──────────────────────────────────────────────────
    const artifactPath = path.join(
        __dirname,
        "../artifacts/contracts/MockUSDT.sol/MockUSDT.json"
    );

    // ABI sync runs after artifact exists (post-compilation)
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

        // Frontend: wrapped { abi: [...] } format
        const frontendAbiPath = path.join(
            __dirname,
            "../../frontend/src/contracts/MockUSDT.json"
        );
        fs.writeFileSync(
            frontendAbiPath,
            JSON.stringify({ abi: artifact.abi }, null, 2)
        );
        console.log("📄  Synced ABI: frontend/src/contracts/MockUSDT.json");

        // Backend: flat array format
        const backendAbiPath = path.join(
            __dirname,
            "../../backend/contracts/MockUSDT.json"
        );
        fs.writeFileSync(backendAbiPath, JSON.stringify(artifact.abi, null, 2));
        console.log("📄  Synced ABI: backend/contracts/MockUSDT.json");
    }

    console.log("\n====================================================");
    console.log("  DONE — MockUSDT:", address);
    console.log("  View on Etherscan:");
    console.log(`  https://sepolia.etherscan.io/address/${address}`);
    console.log("====================================================\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌  Deployment failed:", err.message);
        process.exit(1);
    });
