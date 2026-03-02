require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const LoanRequest = require('./models/LoanRequest');

async function fixAgreements() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    try {
        const borrower = await User.findOne({ email: 'ayushdayal900@gmail.com' });
        const lender = await User.findOne({ email: 'narendrasaraf16@gmail.com' });

        await LoanRequest.deleteMany({});
        console.log("Deleted old pending loans.");

        // Instead of fetching from factory, just insert the known ones
        const addrs = [
            "0xee082864FbC07E2B04E5beE10A4D53359D9A183d",
            "0x97fF2C4c278fb1B3C00A85507E792D481C592A5b"
        ];

        for (let a of addrs) {
            const loan = await LoanRequest.create({
                borrower: borrower._id,
                lender: lender._id,
                amountRequested: 50,
                interestRate: 10,
                durationMonths: 1,
                purpose: 'AutoPay Test',
                loanMode: 1, // ERC20
                status: 'Funded',
                simulatedSmartContractId: a,
                isActive: true
            });
            console.log("Created loan record for", a, "->", loan._id);
        }
    } catch (err) {
        console.error("Failed:", err);
    }

    process.exit(0);
}

fixAgreements();
