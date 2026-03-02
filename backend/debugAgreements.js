require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const _agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreement.json'), 'utf8'));
const agreementAbi = Array.isArray(_agreementAbi) ? _agreementAbi : _agreementAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));

async function debugUpcoming() {
    console.log("Starting...");
    const factoryAddress = backendAddresses.loanFactory;
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('./models/User');

    // Find lenders
    const realLenders = await User.find({ role: 'Lender' }).exists('walletAddress', true);
    console.log("Lenders found:", realLenders.map(l => l.walletAddress));

    if (realLenders.length === 0) return process.exit(0);

    for (const lender of realLenders) {
        const userWalletAddress = lender.walletAddress;

        try {
            const agreementAddresses = await factory.getLenderAgreements(userWalletAddress);
            if (agreementAddresses.length > 0) {
                console.log(`\n===========================================`);
                console.log(`FOUND LENDER WITH AGREEMENTS: ${userWalletAddress}`);
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
                        console.log("=> Skipped by backend API logic (completed or 0 remaining)");
                    } else {
                        console.log("=> Would be included!");
                    }
                }
            }
        } catch (e) {
            console.error(`RPC Error for ${userWalletAddress}:`, e.shortMessage || e.message);
        }
    }
    process.exit(0);
}

debugUpcoming();
