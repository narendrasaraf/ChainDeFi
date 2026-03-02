const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, '../frontend');
const BACKEND_DIR = path.join(ROOT_DIR, '../backend');

const DEPLOYED_ADDRESSES_PATH = path.join(ROOT_DIR, 'deployedAddresses.json');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts/contracts');

function sync() {
    console.log('🔄 Syncing blockchain artifacts to frontend and backend...');

    if (!fs.existsSync(DEPLOYED_ADDRESSES_PATH)) {
        console.error('❌ deployedAddresses.json not found! Run deployment first.');
        return;
    }

    const addresses = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_PATH, 'utf8'));

    // 1. Sync to Frontend
    const frontendContractsDir = path.join(FRONTEND_DIR, 'src/contracts');
    if (!fs.existsSync(frontendContractsDir)) {
        fs.mkdirSync(frontendContractsDir, { recursive: true });
    }

    // Save addresses to frontend
    fs.writeFileSync(
        path.join(frontendContractsDir, 'addresses.json'),
        JSON.stringify(addresses, null, 2)
    );

    // Save ABIs to frontend
    const contractsToSync = [
        'Microfinance.sol/Microfinance.json',
        'SoulboundIdentity.sol/SoulboundIdentity.json',
        'TrustScoreRegistry.sol/TrustScoreRegistry.json'
    ];

    contractsToSync.forEach(contractPath => {
        const sourcePath = path.join(ARTIFACTS_DIR, contractPath);
        if (fs.existsSync(sourcePath)) {
            const artifact = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
            const fileName = path.basename(contractPath);
            fs.writeFileSync(
                path.join(frontendContractsDir, fileName),
                JSON.stringify(artifact.abi, null, 2)
            );
            console.log(`✅ Synced ABI: ${fileName} to frontend`);
        }
    });

    // 2. Sync to Backend
    const backendContractsDir = path.join(BACKEND_DIR, 'contracts');
    if (!fs.existsSync(backendContractsDir)) {
        fs.mkdirSync(backendContractsDir, { recursive: true });
    }

    // Save addresses to backend
    fs.writeFileSync(
        path.join(backendContractsDir, 'addresses.json'),
        JSON.stringify(addresses, null, 2)
    );

    // Save ABIs to backend
    contractsToSync.forEach(contractPath => {
        const sourcePath = path.join(ARTIFACTS_DIR, contractPath);
        if (fs.existsSync(sourcePath)) {
            const artifact = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
            const fileName = path.basename(contractPath);
            fs.writeFileSync(
                path.join(backendContractsDir, fileName),
                JSON.stringify(artifact.abi, null, 2)
            );
            console.log(`✅ Synced ABI: ${fileName} to backend`);
        }
    });

    console.log('🎉 Blockchain sync complete!');
}

sync();
