// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Identity
 * @dev Interface for the Soulbound Identity contract to check for NFT ownership.
 */
interface Identity {
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title ITrustScoreRegistry
 * @dev Interface for the Trust Score contract to increment reputation.
 */
interface ITrustScoreRegistry {
    function increment(address user) external;
}

/**
 * @title Microfinance
 * @dev Peer-to-peer microfinance lending contract with protocol fee collection.
 */
contract Microfinance is ReentrancyGuard {
    // --- State ---
    address public owner;
    address public identityContract;
    address public treasury;
    ITrustScoreRegistry public immutable trustScore;

    uint256 public protocolFeeBasisPoints = 100; // 1% (100 / 10000)

    struct Loan {
        uint256 id;
        address borrower;
        address lender;
        uint256 amount;
        uint256 interest;
        uint256 duration;
        bool funded;
        bool repaid;
    }

    uint256 public loanCounter;
    mapping(uint256 => Loan) public loans;

    // --- Events ---
    event LoanCreated(uint256 indexed id, address indexed borrower, uint256 amount, uint256 interest, uint256 duration);
    event LoanFunded(uint256 indexed id, address indexed lender);
    event LoanRepaid(uint256 indexed id, address indexed borrower);
    event ProtocolFeeCollected(uint256 indexed loanId, uint256 fee);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);

    // --- Constructor ---
    constructor(address _identityContract, address _trustScore, address _treasury) {
        owner = msg.sender;
        identityContract = _identityContract;
        trustScore = ITrustScoreRegistry(_trustScore);
        treasury = _treasury;
    }

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVerifiedUser() {
        require(
            Identity(identityContract).balanceOf(msg.sender) > 0,
            "Not verified"
        );
        _;
    }

    // --- Debug / Admin ---

    function getIdentityAddress() public view returns (address) {
        return identityContract;
    }

    /**
     * @dev Owner can update the protocol fee (capped at 10%).
     */
    function setProtocolFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "Fee too high");
        emit ProtocolFeeUpdated(protocolFeeBasisPoints, _newFeeBps);
        protocolFeeBasisPoints = _newFeeBps;
    }

    /**
     * @dev Owner can update the treasury address.
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Zero address");
        treasury = _newTreasury;
    }

    // --- Core Functions ---

    /**
     * @dev Creates a new loan request on-chain.
     */
    function createLoan(uint256 _amount, uint256 _interest, uint256 _duration) external onlyVerifiedUser {
        require(_amount > 0, "Invalid amount");

        loanCounter++;
        loans[loanCounter] = Loan({
            id: loanCounter,
            borrower: msg.sender,
            lender: address(0),
            amount: _amount,
            interest: _interest,
            duration: _duration,
            funded: false,
            repaid: false
        });

        emit LoanCreated(loanCounter, msg.sender, _amount, _interest, _duration);
    }

    /**
     * @dev Lenders fund a loan. Protocol fee is deducted and sent to treasury.
     *      Net amount (principal - fee) is sent to borrower.
     */
    function fundLoan(uint256 _id) external payable onlyVerifiedUser nonReentrant {
        Loan storage loan = loans[_id];

        require(loan.id != 0, "Loan does not exist");
        require(!loan.funded, "Already funded");
        require(msg.sender != loan.borrower, "Borrower cannot fund own loan");
        require(msg.value == loan.amount, "Incorrect funding amount");

        loan.lender = msg.sender;
        loan.funded = true;

        // Protocol fee calculation
        uint256 fee = (msg.value * protocolFeeBasisPoints) / 10000;
        uint256 netAmount = msg.value - fee;

        // Transfer net amount to borrower
        (bool ok1, ) = payable(loan.borrower).call{value: netAmount}("");
        require(ok1, "Transfer to borrower failed");

        // Transfer fee to treasury
        if (fee > 0) {
            (bool ok2, ) = payable(treasury).call{value: fee}("");
            require(ok2, "Fee transfer to treasury failed");
            emit ProtocolFeeCollected(_id, fee);
        }

        emit LoanFunded(_id, msg.sender);
    }

    /**
     * @dev Borrowers repay their loan (principal + interest) directly to lender.
     */
    function repayLoan(uint256 _id) external payable onlyVerifiedUser nonReentrant {
        Loan storage loan = loans[_id];

        require(loan.funded, "Loan not funded");
        require(!loan.repaid, "Already repaid");
        require(msg.sender == loan.borrower, "Only borrower can repay");

        uint256 total = loan.amount + loan.interest;
        require(msg.value == total, "Incorrect repayment amount");

        loan.repaid = true;

        (bool success, ) = payable(loan.lender).call{value: msg.value}("");
        require(success, "Transfer to lender failed");

        trustScore.increment(loan.borrower);

        emit LoanRepaid(_id, msg.sender);
    }

    // --- View Functions ---

    /**
     * @dev Returns a single loan's details.
     */
    function getLoanDetails(uint256 _id) external view returns (Loan memory) {
        return loans[_id];
    }

    /**
     * @dev Returns ALL loans from id=1 to loanCounter as an array.
     *      Frontend can filter by borrower/lender address.
     */
    function getAllLoans() public view returns (Loan[] memory) {
        if (loanCounter == 0) return new Loan[](0);
        Loan[] memory allLoans = new Loan[](loanCounter);
        for (uint256 i = 1; i <= loanCounter; i++) {
            allLoans[i - 1] = loans[i];
        }
        return allLoans;
    }
}
