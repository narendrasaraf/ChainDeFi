require('dotenv').config();
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const LoanRequest = require('./models/LoanRequest');
const User = require('./models/User');

const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const backendAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));

async function syncAgreements() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const factory = new ethers.Contract(backendAddresses.loanFactory, factoryAbi, provider);

    const users = await User.find({ walletAddress: { $exists: true, $ne: null } });

    for (const u of users) {
        if (u.role === 'Borrower') {
            const addrs = await factory.getBorrowerAgreements(u.walletAddress).catch(() => []);
            for (const agrAddr of addrs) {
                // Find a pending loan for this borrower and mark it active
                const loan = await LoanRequest.findOne({ borrower: u._id, status: 'Pending' });
                if (loan) {
                    console.log(`Linking agreement ${agrAddr} to loan ${loan._id}`);
                    loan.status = 'Funded';
                    loan.simulatedSmartContractId = agrAddr;
                    await loan.save();
                } else {
                    // Check if already linked
                    const existing = await LoanRequest.findOne({ simulatedSmartContractId: agrAddr });
                    if (!existing) {
                        console.log(`Creating new DB entry for agreement ${agrAddr}`);
                        await LoanRequest.create({
                            borrower: u._id,
                            amountRequested: 50, // mock payload
                            interestRate: 10,
                            durationMonths: 1,
                            purpose: 'Sync',
                            loanMode: 1, // ERC20
                            status: 'Funded',
                            simulatedSmartContractId: agrAddr
                        });
                    }
                }
            }
        }
    }
    console.log("Sync complete.");
    process.exit(0);
}

syncAgreements();
