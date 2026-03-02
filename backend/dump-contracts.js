require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const _agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreement.json'), 'utf8'));
const agreementAbi = Array.isArray(_agreementAbi) ? _agreementAbi : _agreementAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));

async function check() {
    // Let's use standard Sepolia RPC because publicnode seems dead
    const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
    const factory = new ethers.Contract(backendAddresses.loanFactory, factoryAbi, provider);

    const rawWallet = "0x937172C4C278FB1B3C00A85507E792D481C592A5";
    const wallet = ethers.getAddress(rawWallet.toLowerCase());

    try {
        const addrs = await factory.getBorrowerAgreements(wallet);
        console.log("Real Active Agreements for Wallet:");
        console.log(addrs);

        for (let a of addrs) {
            console.log(`\nTesting Agreement: ${a}`);
            const agr = new ethers.Contract(a, agreementAbi, provider);
            try {
                const status = await agr.getStatus();
                console.log("- Status:", status);
                console.log("- Mode:", await agr.getLoanMode());
            } catch (e) {
                console.error("- Read failed:", e.message);
            }
        }
    } catch (err) {
        console.error("Factory Error:", err.message);
    }
    process.exit(0);
}

check();
