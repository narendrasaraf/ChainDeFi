const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function debug() {
    const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpc);

    // Addresses
    const agrAddr = "0x97fF2C4c096199Cb3a45fb9fEDF3603f4D592A5b";
    const usdtAddr = "0xec78C8BB7d36bCd2e0ecDbdb231fB192fbA392fE";

    // ABI
    const agrAbi = [
        "function borrower() view returns (address)",
        "function token() view returns (address)",
        "function getStatus() view returns (uint256,uint256,uint256,uint256,uint256,bool,uint256,bool,uint256)"
    ];
    const usdtAbi = [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)"
    ];

    const agr = new ethers.Contract(agrAddr, agrAbi, provider);
    const usdt = new ethers.Contract(usdtAddr, usdtAbi, provider);

    console.log("--- Agreement Diagnostic ---");
    const borrower = await agr.borrower();
    const token = await agr.token();
    console.log("Borrower on-chain:", borrower);
    console.log("Token on-chain:   ", token);

    const bal = await usdt.balanceOf(borrower);
    const allowance = await usdt.allowance(borrower, agrAddr);

    console.log("Borrower Balance:  ", ethers.formatUnits(bal, 6), "tUSDT");
    console.log("Current Allowance: ", ethers.formatUnits(allowance, 6), "tUSDT");

    const status = await agr.getStatus();
    console.log("\ngetStatus() results:");
    console.log("- Payments Made:", status[0].toString());
    console.log("- Allowance in status:", ethers.formatUnits(status[8], 6));
}

debug().catch(console.error);
