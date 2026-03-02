const mongoose = require('mongoose');
require('./models/User'); // Register User model
const LoanRequest = require('./models/LoanRequest');
require('dotenv').config();

async function listLoans() {
    await mongoose.connect(process.env.MONGO_URI);
    const loans = await LoanRequest.find({ status: 'Funded' }).populate('borrower');
    console.log(`Found ${loans.length} funded loans:`);
    loans.forEach(l => {
        console.log(`ID: ${l._id} | Agrmnt: ${l.simulatedSmartContractId} | Borrower: ${l.borrower?.walletAddress}`);
    });
    process.exit(0);
}

listLoans().catch(console.error);
