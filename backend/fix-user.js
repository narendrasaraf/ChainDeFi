const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const LoanRequest = require('./models/LoanRequest');

async function fixUserAndLoans() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'ayushdayal900@gmail.com';
        const correctWallet = '0x4054188103d51555389734b43c6abfba4b07df94';

        const user = await User.findOne({ email });
        if (user) {
            console.log(`Updating wallet for ${email} to ${correctWallet}`);
            user.walletAddress = correctWallet.toLowerCase();
            await user.save();
        }

        // Delete the broken mock loans from fix-agreements.js
        const deleted = await LoanRequest.deleteMany({ purpose: 'AutoPay Test' });
        console.log(`Deleted ${deleted.deletedCount} broken mock loans.`);

        await mongoose.disconnect();
        console.log('Done.');
    } catch (err) {
        console.error('Error:', err);
    }
}

fixUserAndLoans();
