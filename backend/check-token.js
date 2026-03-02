const { ethers } = require('ethers');
async function check() {
    const rpc = "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; // Public Infura
    const provider = new ethers.JsonRpcProvider(rpc);
    const agrAddr = "0x97fF2C4c096199Cb3a45fb9fEDF3603f4D592A5b";
    const agrAbi = ["function token() view returns (address)"];
    const agr = new ethers.Contract(agrAddr, agrAbi, provider);
    const token = await agr.token();
    console.log("Token in Agreement:", token);
    process.exit(0);
}
check();
