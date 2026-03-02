const { expect } = require("chai");
const hre = require("hardhat");

describe("TrustScoreRegistry", function () {
    let trustRegistry;
    let owner;
    let user;

    beforeEach(async function () {
        [owner, user] = await hre.ethers.getSigners();
        const TrustScoreRegistry = await hre.ethers.getContractFactory("TrustScoreRegistry");
        trustRegistry = await TrustScoreRegistry.deploy(owner.address);
        await trustRegistry.waitForDeployment();
    });

    it("Should allow owner to update trust score", async function () {
        const score = 850;
        await expect(trustRegistry.updateTrustScore(user.address, score))
            .to.emit(trustRegistry, "TrustScoreUpdated")
            .withArgs(user.address, 0, score);

        expect(await trustRegistry.getTrustScore(user.address)).to.equal(score);
    });

    it("Should prevent unauthorized addresses from updating scores", async function () {
        await expect(
            trustRegistry.connect(user).updateTrustScore(user.address, 500)
        ).to.be.revertedWith("Not authorized");
    });

    it("Should allow authorized addresses to update scores", async function () {
        await trustRegistry.setAuthorized(user.address, true);
        await expect(trustRegistry.connect(user).updateTrustScore(user.address, 500))
            .to.emit(trustRegistry, "TrustScoreUpdated");
    });

    it("Should prevent invalid scores (above 1000)", async function () {
        await expect(
            trustRegistry.updateTrustScore(user.address, 1001)
        ).to.be.revertedWithCustomError(trustRegistry, "TrustScore_InvalidScore");
    });

    it("Should return zero for a new address", async function () {
        expect(await trustRegistry.getTrustScore(hre.ethers.ZeroAddress)).to.equal(0);
    });
});
