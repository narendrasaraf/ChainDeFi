require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const LoanRequest = require('./models/LoanRequest');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    const users = await User.find({});
    console.log(`Total users: ${users.length}`);
    for (const u of users) {
        console.log(`User: ${u.email} | Role: ${u.role} | Wallet: ${u.walletAddress}`);
    }

    const loans = await LoanRequest.find({});
    console.log(`\nTotal loans: ${loans.length}`);
    for (const l of loans) {
        console.log(`Loan ID: ${l._id} | Status: ${l.status} | Contract: ${l.simulatedSmartContractId}`);
    }

    process.exit(0);
}

test();
