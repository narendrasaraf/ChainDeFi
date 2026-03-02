const { expect } = require("chai");
const hre = require("hardhat");

describe("SoulboundIdentity", function () {
    let identityContract;
    let owner;
    let user1;
    let user2;

    beforeEach(async function () {
        [owner, user1, user2] = await hre.ethers.getSigners();
        const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
        identityContract = await SoulboundIdentity.deploy(owner.address);
        await identityContract.waitForDeployment();
    });

    it("Should allow any user to mint an identity", async function () {
        await identityContract.connect(user1).mintIdentity();
        expect(await identityContract.balanceOf(user1.address)).to.equal(1);
    });

    // it("Should prevent non-owners from minting", async function () {
    //     await expect(
    //         identityContract.connect(user1).mintIdentity(user2.address)
    //     ).to.be.revertedWithCustomError(identityContract, "OwnableUnauthorizedAccount");
    // });

    it("Should prevent a user from having more than one identity", async function () {
        await identityContract.connect(user1).mintIdentity();
        await expect(
            identityContract.connect(user1).mintIdentity()
        ).to.be.revertedWithCustomError(identityContract, "Soulbound_AlreadyHasIdentity");
    });

    it("Should prevent all transfers (Soulbound)", async function () {
        await identityContract.connect(user1).mintIdentity();
        const tokenId = 1;

        // Direct transfer
        await expect(
            identityContract.connect(user1).transferFrom(user1.address, user2.address, tokenId)
        ).to.be.revertedWithCustomError(identityContract, "Soulbound_NoTransferAllowed");

        // Safe transfer
        await expect(
            identityContract.connect(user1)["safeTransferFrom(address,address,uint256)"](user1.address, user2.address, tokenId)
        ).to.be.revertedWithCustomError(identityContract, "Soulbound_NoTransferAllowed");
    });

    it("Should prevent approvals", async function () {
        await identityContract.connect(user1).mintIdentity();
        const tokenId = 1;

        await expect(
            identityContract.connect(user1).approve(user2.address, tokenId)
        ).to.be.revertedWithCustomError(identityContract, "Soulbound_NoTransferAllowed");

        await expect(
            identityContract.connect(user1).setApprovalForAll(user2.address, true)
        ).to.be.revertedWithCustomError(identityContract, "Soulbound_NoTransferAllowed");
    });
});
