const { ethers } = require('ethers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function checkFactory() {
    try {
        const rpc = process.env.RPC_URL;
        const provider = new ethers.JsonRpcProvider(rpc);

        const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));
        const factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));

        const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, provider);
        const autoSvc = await factory.automationService();
        console.log('Factory automationService:', autoSvc);

        const treasury = await factory.treasury();
        console.log('Factory treasury:', treasury);

    } catch (err) {
        console.error('Error:', err);
    }
}

checkFactory();
