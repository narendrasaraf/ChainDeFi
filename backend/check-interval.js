require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const _factoryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreementFactory.json'), 'utf8'));
const factoryAbi = Array.isArray(_factoryAbi) ? _factoryAbi : _factoryAbi.abi;
const _agreementAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/LoanAgreement.json'), 'utf8'));
const agreementAbi = Array.isArray(_agreementAbi) ? _agreementAbi : _agreementAbi.abi;
const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/addresses.json'), 'utf8'));

async function checkInterval() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const factory = new ethers.Contract(addresses.loanFactory, factoryAbi, provider);

    const borrowerWallet = "0x937172C4C278FB1B3C00A85507E792D481C592A5";
    const wallet = ethers.getAddress(borrowerWallet.toLowerCase());

    try {
        const agrs = await factory.getBorrowerAgreements(wallet);
        if (agrs.length > 0) {
            const agr = new ethers.Contract(agrs[0], agreementAbi, provider);
            const interval = await agr.REPAYMENT_INTERVAL();
            console.log(`Repayment Interval: ${interval} seconds`);
        } else {
            console.log("No agreements found for this borrower.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}

checkInterval();
