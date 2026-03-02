const { expect } = require("chai");
const hre = require("hardhat");

describe("Microfinance", function () {
    let microfinance;
    let identity;
    let owner;
    let borrower;
    let lender;
    let other;

    const loanAmount = hre.ethers.parseEther("1.0");
    const interest = hre.ethers.parseEther("0.1");
    const totalRepayment = hre.ethers.parseEther("1.1");
    const duration = 3600; // 1 hour

    beforeEach(async function () {
        [owner, borrower, lender, other] = await hre.ethers.getSigners();

        // Deploy Identity
        const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
        identity = await SoulboundIdentity.deploy(owner.address);
        await identity.waitForDeployment();
        const identityAddress = await identity.getAddress();

        // Mint identities for everyone
        await identity.connect(borrower).mintIdentity();
        await identity.connect(lender).mintIdentity();
        await identity.connect(other).mintIdentity();

        // Deploy TrustScoreRegistry
        const TrustScoreRegistry = await hre.ethers.getContractFactory("TrustScoreRegistry");
        trustRegistry = await TrustScoreRegistry.deploy(owner.address);
        await trustRegistry.waitForDeployment();
        const trustRegistryAddress = await trustRegistry.getAddress();

        // Deploy Microfinance
        const Microfinance = await hre.ethers.getContractFactory("Microfinance");
        microfinance = await Microfinance.deploy(identityAddress, trustRegistryAddress);
        await microfinance.waitForDeployment();
        const microfinanceAddress = await microfinance.getAddress();

        // Authorize Microfinance in TrustScoreRegistry
        await trustRegistry.setAuthorized(microfinanceAddress, true);
    });

    it("Should create a loan request", async function () {
        await expect(microfinance.connect(borrower).createLoan(loanAmount, interest, duration))
            .to.emit(microfinance, "LoanCreated")
            .withArgs(1, borrower.address, loanAmount, interest, duration);

        const loan = await microfinance.getLoanDetails(1);
        expect(loan.borrower).to.equal(borrower.address);
        expect(loan.amount).to.equal(loanAmount);
        expect(loan.interest).to.equal(interest);
        expect(loan.funded).to.be.false;
        expect(loan.repaid).to.be.false;
    });

    it("Should fund a loan and transfer funds to borrower", async function () {
        await microfinance.connect(borrower).createLoan(loanAmount, interest, duration);

        const borrowerBalanceBefore = await hre.ethers.provider.getBalance(borrower.address);

        await expect(microfinance.connect(lender).fundLoan(1, { value: loanAmount }))
            .to.emit(microfinance, "LoanFunded")
            .withArgs(1, lender.address);

        const borrowerBalanceAfter = await hre.ethers.provider.getBalance(borrower.address);
        expect(borrowerBalanceAfter - borrowerBalanceBefore).to.equal(loanAmount);

        const loan = await microfinance.getLoanDetails(1);
        expect(loan.lender).to.equal(lender.address);
        expect(loan.funded).to.be.true;
    });

    it("Should repay a loan, transfer funds to lender, and increment trust score", async function () {
        await microfinance.connect(borrower).createLoan(loanAmount, interest, duration);
        await microfinance.connect(lender).fundLoan(1, { value: loanAmount });

        const lenderBalanceBefore = await hre.ethers.provider.getBalance(lender.address);
        const scoreBefore = await trustRegistry.getTrustScore(borrower.address);

        await expect(microfinance.connect(borrower).repayLoan(1, { value: totalRepayment }))
            .to.emit(microfinance, "LoanRepaid")
            .withArgs(1, borrower.address);

        const lenderBalanceAfter = await hre.ethers.provider.getBalance(lender.address);
        expect(lenderBalanceAfter - lenderBalanceBefore).to.equal(totalRepayment);

        const loan = await microfinance.getLoanDetails(1);
        expect(loan.repaid).to.be.true;

        const scoreAfter = await trustRegistry.getTrustScore(borrower.address);
        expect(scoreAfter).to.equal(scoreBefore + 25n);
    });

    it("Should fail if repayment amount is incorrect", async function () {
        await microfinance.connect(borrower).createLoan(loanAmount, interest, duration);
        await microfinance.connect(lender).fundLoan(1, { value: loanAmount });

        await expect(microfinance.connect(borrower).repayLoan(1, { value: hre.ethers.parseEther("0.5") }))
            .to.be.revertedWith("Incorrect repayment amount");
    });

    it("Should fail if non-verified user tries to create a loan", async function () {
        const [, , , , unverified] = await hre.ethers.getSigners();
        // unverified doesn't have an identity NFT
        await expect(microfinance.connect(unverified).createLoan(loanAmount, interest, duration))
            .to.be.revertedWith("Not verified");
    });

    it("Should fail if borrower tries to fund their own loan", async function () {
        await microfinance.connect(borrower).createLoan(loanAmount, interest, duration);
        await expect(microfinance.connect(borrower).fundLoan(1, { value: loanAmount }))
            .to.be.revertedWith("Borrower cannot fund own loan");
    });
});
