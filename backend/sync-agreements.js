const mongoose = require('mongoose');
const { ethers } = require('ethers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const LoanRequest = require('./models/LoanRequest');
const User = require('./models/User');

async function syncRealAgreements() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const rpc = process.env.RPC_URL;
        const provider = new ethers.JsonRpcProvider(rpc);

        const addressesJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));
        const factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));

        const factory = new ethers.Contract(addressesJson.loanFactory, factoryAbi, provider);

        console.log('Fetching all requests from factory:', addressesJson.loanFactory);
        const allRequests = await factory.getAllRequests();
        console.log(`Factory returned ${allRequests.length} requests.`);

        for (const req of allRequests) {
            const borrowerAddr = req.borrower.toLowerCase();
            const agreementAddr = req.agreementAddress;
            const isFunded = req.funded;

            if (isFunded && agreementAddr !== ethers.ZeroAddress) {
                console.log(`\nFound Funded Agreement: ${agreementAddr}`);
                console.log(`Borrower: ${borrowerAddr}`);

                const borrowerUser = await User.findOne({ walletAddress: borrowerAddr });
                if (!borrowerUser) {
                    console.log(`⚠️ Borrower user not found in DB for address ${borrowerAddr}`);
                    continue;
                }

                // Try to find a matching loan request in DB, or create one
                // We'll search by borrower and a "Funded" status, or just create a new one to be sure
                let loan = await LoanRequest.findOne({
                    simulatedSmartContractId: agreementAddr
                });

                if (!loan) {
                    console.log(`Creating new DB record for agreement ${agreementAddr}`);
                    const principal = Number(ethers.formatUnits(req.principal, req.mode === 0n ? 18 : 6));
                    const totalRepayment = Number(ethers.formatUnits(req.totalRepayment, req.mode === 0n ? 18 : 6));
                    const interestRate = principal > 0 ? ((totalRepayment - principal) / principal) * 100 : 0;

                    loan = new LoanRequest({
                        borrower: borrowerUser._id,
                        status: 'Funded',
                        simulatedSmartContractId: agreementAddr,
                        amountRequested: principal,
                        interestRate: Math.max(0, interestRate),
                        durationMonths: Number(req.durationInMonths),
                        purpose: 'On-chain Agreement Sync',
                        loanMode: Number(req.mode),
                        isActive: true
                    });
                }

                // Deep Sync from Agreement Contract
                try {
                    const agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreement.json'), 'utf8'));
                    const agr = new ethers.Contract(agreementAddr, agreementAbi, provider);
                    const status = await agr.getStatus();

                    loan.paymentsMade = Number(status._paymentsMade);
                    loan.missedPayments = Number(status._missedPayments);

                    if (status._completed) {
                        loan.status = 'Repaid';
                        loan.isActive = false;
                    } else if (status._missedPayments > 3) {
                        loan.status = 'Defaulted';
                        loan.isActive = false;
                    } else {
                        loan.status = 'Funded';
                        loan.isActive = true;
                    }

                    console.log(`- Progress: ${loan.paymentsMade}/${loan.durationMonths} payments. Status: ${loan.status}`);
                } catch (agrErr) {
                    console.warn(`- Failed to deep sync agreement ${agreementAddr}: ${agrErr.message}`);
                    loan.status = 'Funded';
                }

                await loan.save();
                console.log(`✅ Synced loan ${loan._id}`);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

syncRealAgreements();
