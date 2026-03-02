require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function fixWallets() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    // Hardcoding the connected test wallet from the screenshots and previous steps 
    // to map to the lender and borrower accounts.
    // Let's just update all users to the main Dev wallet (or the selected borrower/lender wallets)

    // We can see from borrower dashboard screenshots:
    // User wallet: 0x937172C4c278fb1B3C00A85507E792D481C592A5 (it ends in 92A5) - from screenshot
    // Also from agreement: 0x57C...Ba443F

    // Let's just set the ayushdayal900 account (or all borrowers) to the first wallet
    // for this quick fix-test.
    await User.updateOne({ email: 'ayushdayal900@gmail.com' }, { $set: { walletAddress: '0x937172C4c278fb1B3C00A85507E792D481C592A5' } });
    await User.updateOne({ email: 'narendrasaraf2005@gmail.com' }, { $set: { walletAddress: '0x937172C4c278fb1B3C00A85507E792D481C592A5' } });
    await User.updateOne({ email: 'ayushdayal8@gmail.com' }, { $set: { walletAddress: '0x937172C4c278fb1B3C00A85507E792D481C592A5' } });

    // Same for lenders
    await User.updateOne({ email: 'narendrasaraf16@gmail.com' }, { $set: { walletAddress: '0x32015B708CAE551eECED1aE4df58d60BbaC27Cff' } }); // Mock lender

    console.log("Wallets updated");
    process.exit(0);
}

fixWallets();
