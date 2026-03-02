const { ethers } = require('ethers');
require('dotenv').config();

const pk = process.env.PRIVATE_KEY;
if (!pk) {
    console.error('PRIVATE_KEY not found in .env');
    process.exit(1);
}

const wallet = new ethers.Wallet(pk);
console.log('Address:', wallet.address);
