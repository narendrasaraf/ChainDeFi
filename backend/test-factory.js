require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));

async function check() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const factory = new ethers.Contract(backendAddresses.loanFactory, factoryAbi, provider);

    // Using correct checksummatic format
    const rawWallet = "0x937172C4c278fb1B3C00A85507E792D481C592A5".toLowerCase();
    const wallet = ethers.getAddress(rawWallet);
    console.log(`Checking agreements for: ${wallet}`);

    try {
        const addrs = await factory.getBorrowerAgreements(wallet);
        console.log("Agreements found:", addrs);
    } catch (err) {
        console.error("Error calling factory:", err.message);
    }
    process.exit(0);
}

check();
