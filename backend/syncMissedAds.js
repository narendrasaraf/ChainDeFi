require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const LoanRequest = require('./models/LoanRequest');

const factoryAbiJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(factoryAbiJson) ? factoryAbiJson : factoryAbiJson.abi;
const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));

async function syncMissedAds() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, provider);

    const activeBorrowers = await User.find({ role: 'Borrower' }).exists('walletAddress', true);
    let synced = 0;

    for (const b of activeBorrowers) {
        if (!b.walletAddress) continue;
        console.log("Checking on-chain ads for:", b.walletAddress);

        try {
            // Get all agreement contracts (Wait, factory.getBorrowerAgreements returns agreements. How do we get raw "Ads" ? 
            // In the new architecture, the borrower broadcasts a "LoanRequestCreated" event from the factory when they ASK for a loan.
            // When lenders fund, it creates an agreement.)
            const events = await factory.queryFilter(factory.filters.LoanRequestCreated(null, b.walletAddress));

            for (const event of events) {
                const { borrower, principal, repayment, durationMonths, isERC20 } = event.args;

                // Check if this ad already exists in DB
                const amountRequested = Number(ethers.formatEther(principal)); // assuming format matches
                // Or if ERC20, it would be 6 decimals, but let's just do a basic check

                const existingReq = await LoanRequest.findOne({ borrower: b._id, txHash: event.transactionHash });
                if (!existingReq) {
                    let pAmount = Number(ethers.formatEther(principal));
                    if (isERC20) pAmount = Number(ethers.formatUnits(principal, 6));

                    await LoanRequest.create({
                        borrower: b._id,
                        amountRequested: pAmount,
                        interestRate: 10,
                        durationMonths: Number(durationMonths),
                        purpose: isERC20 ? 'ERC20 Request' : 'ETH Request',
                        loanMode: isERC20 ? 1 : 0,
                        status: 'Pending',
                        txHash: event.transactionHash
                    });
                    console.log(`Synced missed ad for ${b.walletAddress} (Tx: ${event.transactionHash})`);
                    synced++;
                }
            }

        } catch (e) {
            console.error(`Error querying ads for ${b.walletAddress}:`, e.shortMessage || e.message);
        }
    }

    console.log(`Finished. Synced ${synced} missed ads.`);
    process.exit(0);
}

syncMissedAds();
