const mongoose = require('mongoose');
require('dotenv').config();
const { startAutoRepayScheduler, forceAutoPay } = require('./services/autoRepayService');

async function testAutopay() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const { ethers } = require('ethers');
        const rpc = process.env.RPC_URL;
        const pk = process.env.PRIVATE_KEY;
        const provider = new ethers.JsonRpcProvider(rpc);
        const signer = new ethers.Wallet(pk, provider);
        console.log('Signer:', signer.address);

        const LoanRequest = require('./models/LoanRequest');
        const loans = await LoanRequest.find({
            status: { $in: ['Funded', 'Active'] },
            simulatedSmartContractId: { $exists: true, $ne: null }
        });

        console.log(`Processing ${loans.length} loans...`);
        loans.forEach(l => console.log(`- ${l._id} | addr: ${l.simulatedSmartContractId}`));

        if (loans.length > 0) {
            // Target the one that has allowance (based on check-loans.js)
            const targetId = '69a238a567ee6177741ea008';
            const targetLoan = loans.find(l => l._id.toString() === targetId) || loans[0];

            console.log(`\nManually triggering for: ${targetLoan._id}`);
            const result = await forceAutoPay(targetLoan._id);
            console.log('Result:', result);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

testAutopay();
