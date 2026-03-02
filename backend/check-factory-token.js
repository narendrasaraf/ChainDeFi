const { ethers } = require('ethers');
async function checkFactory() {
    const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpc);
    const factoryAddr = "0x9C5be9220B98D56f6794f14e25E185DC12C4aaFE";
    const factoryAbi = ["function repaymentToken() view returns (address)"];
    const factory = new ethers.Contract(factoryAddr, factoryAbi, provider);
    const token = await factory.repaymentToken();
    console.log("Factory Token:", token);
    process.exit(0);
}
checkFactory();
