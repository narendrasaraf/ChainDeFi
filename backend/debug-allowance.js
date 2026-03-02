const { ethers } = require('ethers');
async function debug() {
    const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpc);
    const agrAddr = "0x97fF2C4c096199Cb3a45fb9fEDF3603f4D592A5b";
    const agrAbi = ["function borrower() view returns (address)", "function token() view returns (address)"];
    const usdtAbi = ["function allowance(address,address) view returns (uint256)"];
    const agr = new ethers.Contract(agrAddr, agrAbi, provider);
    const borrower = await agr.borrower();
    const token = await agr.token();
    console.log("Agreement:", agrAddr);
    console.log("Borrower: ", borrower);
    console.log("Token:    ", token);
    const usdt = new ethers.Contract(token, usdtAbi, provider);
    const allowance = await usdt.allowance(borrower, agrAddr);
    console.log("Allowance:", ethers.formatUnits(allowance, 6));
    process.exit(0);
}
debug();
