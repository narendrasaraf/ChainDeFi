const { ethers } = require('ethers');
async function check() {
    const rpc = "https://sepolia.gateway.tenderly.co";
    const provider = new ethers.JsonRpcProvider(rpc);
    const agrAddr = "0x97fF2C4c096199Cb3a45fb9fEDF3603f4D592A5b";
    const usdtAddr = "0xec78C8BB7d36bCd2e0ecDbdb231fB192fbA392fE";
    const borrower = "0x4054188103d51555389734b43c6abfba4b07df94";
    const usdtAbi = ["function allowance(address,address) view returns (uint256)"];
    const usdt = new ethers.Contract(usdtAddr, usdtAbi, provider);
    const allowance = await usdt.allowance(borrower, agrAddr);
    console.log("Current Allowance:", ethers.formatUnits(allowance, 6));
    process.exit(0);
}
check();
