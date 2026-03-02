const mongoose = require('mongoose');
const { ethers } = require('ethers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const LoanRequest = require('./models/LoanRequest');

async function checkLoans() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const rpc = process.env.RPC_URL;
        const provider = new ethers.JsonRpcProvider(rpc);

        const agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreement.json'), 'utf8'));

        const loans = await LoanRequest.find({
            status: { $in: ['Funded', 'Active'] },
            simulatedSmartContractId: { $exists: true, $ne: null }
        });

        console.log(`Found ${loans.length} active funded loans.`);
        const latestBlock = await provider.getBlock('latest');
        const now = latestBlock.timestamp;
        console.log(`Current Block Timestamp: ${now} (${new Date(now * 1000).toISOString()})`);

        for (const loan of loans) {
            try {
                const addr = ethers.getAddress(loan.simulatedSmartContractId.toLowerCase());
                const agr = new ethers.Contract(addr, agreementAbi, provider);
                const status = await agr.getStatus();
                const loanMode = await agr.getLoanMode();

                console.log(`\nLoan ID: ${loan._id}`);
                console.log(`Agreement: ${addr}`);
                console.log(`Mode: ${loanMode === 0n ? 'ETH' : 'ERC20'}`);
                console.log(`Payments Made: ${status._paymentsMade}/${status._totalDuration}`);
                console.log(`Next Due: ${status._nextDueTimestamp} (${new Date(Number(status._nextDueTimestamp) * 1000).toISOString()})`);
                console.log(`Diff: ${Number(status._nextDueTimestamp) - now} seconds`);
                console.log(`Completed: ${status._completed}`);
                console.log(`Overdue: ${status._isOverdue}`);
                console.log(`Allowance: ${ethers.formatUnits(status._borrowerAllowance, 6)} tUSDT`);
            } catch (err) {
                console.error(`Error checking contract ${loan.simulatedSmartContractId}:`, err.message);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkLoans();
