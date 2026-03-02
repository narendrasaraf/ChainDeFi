require('dotenv').config({ path: 'frontend/.env' });
require('dotenv').config({ path: 'backend/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const _agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/contracts/LoanAgreement.json'), 'utf8'));
const agreementAbi = Array.isArray(_agreementAbi) ? _agreementAbi : _agreementAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/contracts/addresses.json'), 'utf8'));

async function debugUpcoming() {
    const factoryAddress = backendAddresses.loanFactory;
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

    // Let's grab events or just check a random lender address that we see in the system
    // We can query the factory for all agreements
    // Since we don't know the exact wallet address of the user right now, we can fetch an agreement directly if we knew it.
    // Let's run a mongoose query to get the lender wallet address.
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('./backend/models/User');

    // Find lenders
    const lenders = await User.find({ role: 'Lender', walletAddress: null });
    const realLenders = await User.find({ role: 'Lender' }).exists('walletAddress', true);
    console.log("Lenders found:", realLenders.map(l => l.walletAddress));

    if (realLenders.length === 0) return process.exit(0);

    const userWalletAddress = realLenders[0].walletAddress;
    console.log("Using lender address:", userWalletAddress);

    try {
        const agreementAddresses = await factory.getLenderAgreements(userWalletAddress);
        console.log(`Lender ${userWalletAddress} has ${agreementAddresses.length} agreements`);

        for (const agrAddr of agreementAddresses) {
            console.log("\nChecking", agrAddr);
            const agr = new ethers.Contract(agrAddr, agreementAbi, provider);
            const status = await agr.getStatus();
            const completed = status._completed;
            const remainingPayments = Number(status._remainingPayments);

            console.log("Completed:", completed);
            console.log("Remaining payments:", remainingPayments);
            console.log("Next due ts:", Number(status._nextDueTimestamp));

            if (completed || remainingPayments === 0) {
                console.log("=> Skipped by logic");
            } else {
                console.log("=> Would be included!");
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

debugUpcoming();
