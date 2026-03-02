// scripts/deployFactory.js
// Deploys LoanAgreementFactory + syncs addresses and ABI to frontend and backend.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying LoanAgreementFactory with deployer:", deployer.address);

    // --- Load existing addresses to get identity + treasury ---
    const addressesPath = path.join(__dirname, "../deployedAddresses.json");
    let current = {};
    if (fs.existsSync(addressesPath)) {
        current = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    }

    const identityAddress = current.identity;
    const treasuryAddress = current.treasury || deployer.address;
    const repaymentToken = current.mockUSDT;
    const trustScoreAddress = current.trustScore;

    if (!identityAddress) {
        throw new Error("Identity contract address not found in deployedAddresses.json. Deploy Identity first.");
    }
    if (!repaymentToken) {
        throw new Error("mockUSDT address not found in deployedAddresses.json. Run deployMockUSDT.js first.");
    }
    if (!trustScoreAddress) {
        throw new Error("trustScore address not found in deployedAddresses.json.");
    }

    console.log("Using Identity:       ", identityAddress);
    console.log("Using Treasury:       ", treasuryAddress);
    console.log("Using RepaymentToken: ", repaymentToken);
    console.log("Using TrustScore:     ", trustScoreAddress);

    // automationService = deployer wallet (matches backend PRIVATE_KEY)
    const automationService = deployer.address;
    console.log("Using AutomationSvc:  ", automationService);

    // --- Compile ---
    await hre.run("compile");

    // Pre-authorize factory on TrustScoreRegistry (so fundLoanRequest can call setAuthorized)
    // This step must run BEFORE factory deploy is not needed since factory can be authorized after.
    // We'll authorize the factory address AFTER deployment below.

    // --- Deploy LoanAgreementFactory ---
    const Factory = await hre.ethers.getContractFactory("LoanAgreementFactory");
    const factory = await Factory.deploy(
        identityAddress,
        treasuryAddress,
        repaymentToken,
        automationService,
        trustScoreAddress
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("LoanAgreementFactory deployed to:", factoryAddress);

    // Pre-authorize the new factory on TrustScoreRegistry
    // so fundLoanRequest can call setAuthorized(agreementAddr, true) for each new agreement.
    const trustRegistryAbi = [
        "function setAuthorized(address addr, bool status) external"
    ];
    const trustRegistry = new hre.ethers.Contract(trustScoreAddress, trustRegistryAbi, deployer);
    console.log("Authorizing factory on TrustScoreRegistry...");
    try {
        const authTx = await trustRegistry.setAuthorized(factoryAddress, true);
        await authTx.wait();
        console.log("✅  Factory authorized on TrustScoreRegistry:", factoryAddress);
    } catch (authErr) {
        console.warn("⚠️   Could not authorize factory (may not be owner):", authErr.message);
    }

    // --- Update deployedAddresses.json ---
    current.loanFactory = factoryAddress;
    fs.writeFileSync(addressesPath, JSON.stringify(current, null, 2));
    console.log("Updated deployedAddresses.json");

    // ---- Sync ABIs ----
    const factoryArtifact = await hre.artifacts.readArtifact("LoanAgreementFactory");
    const agreementArtifact = await hre.artifacts.readArtifact("LoanAgreement");

    const frontendContracts = path.join(__dirname, "../../frontend/src/contracts");
    const backendContracts = path.join(__dirname, "../../backend/contracts");

    // --- Frontend addresses.json ---
    const feAddressPath = path.join(frontendContracts, "addresses.json");
    let feAddresses = JSON.parse(fs.readFileSync(feAddressPath, "utf8"));
    feAddresses.loanFactory = factoryAddress;
    feAddresses.treasury = treasuryAddress;
    fs.writeFileSync(feAddressPath, JSON.stringify(feAddresses, null, 2));
    console.log("Updated frontend/src/contracts/addresses.json");

    // --- Backend addresses.json ---
    const beAddressPath = path.join(backendContracts, "addresses.json");
    let beAddresses = JSON.parse(fs.readFileSync(beAddressPath, "utf8"));
    beAddresses.loanFactory = factoryAddress;
    beAddresses.treasury = treasuryAddress;
    fs.writeFileSync(beAddressPath, JSON.stringify(beAddresses, null, 2));
    console.log("Updated backend/contracts/addresses.json");

    // --- Factory ABI → frontend (wrapped) ---
    fs.writeFileSync(
        path.join(frontendContracts, "LoanAgreementFactory.json"),
        JSON.stringify({ abi: factoryArtifact.abi }, null, 2)
    );
    // --- Factory ABI → backend (flat array) ---
    fs.writeFileSync(
        path.join(backendContracts, "LoanAgreementFactory.json"),
        JSON.stringify(factoryArtifact.abi, null, 2)
    );

    // --- Agreement ABI → frontend ---
    fs.writeFileSync(
        path.join(frontendContracts, "LoanAgreement.json"),
        JSON.stringify({ abi: agreementArtifact.abi }, null, 2)
    );
    // --- Agreement ABI → backend ---
    fs.writeFileSync(
        path.join(backendContracts, "LoanAgreement.json"),
        JSON.stringify(agreementArtifact.abi, null, 2)
    );

    console.log("ABIs synced to frontend and backend.");
    console.log("\n✅ Deployment complete!");
    console.log("   LoanAgreementFactory:", factoryAddress);
    console.log("   Treasury:            ", treasuryAddress);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
