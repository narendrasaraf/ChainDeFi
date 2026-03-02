require('dotenv').config();
const mongoose = require('mongoose');
const LoanRequest = require('./models/LoanRequest');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    const loans = await LoanRequest.find({});
    console.log(`Total loans: ${loans.length}`);
    for (let l of loans) {
        console.log(`- ID: ${l._id} | Status: ${l.status} | Contract: ${l.simulatedSmartContractId || 'None'} | Mode: ${l.loanMode}`);
    }

    process.exit(0);
}

test();
