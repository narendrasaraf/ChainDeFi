const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({}, 'name email role kycStatus nftIssued walletAddress');
        console.log('User Status Report:');
        console.table(users.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role,
            kyc: u.kycStatus,
            nft: u.nftIssued,
            wallet: u.walletAddress
        })));

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkUsers();
