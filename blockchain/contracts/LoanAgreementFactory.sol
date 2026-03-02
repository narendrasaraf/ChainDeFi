// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanAgreement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IIdentity
 * @dev Interface to verify Soulbound NFT ownership.
 */
interface IIdentity {
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title LoanAgreementFactory
 * @dev P2P loan marketplace. Borrowers post loan requests (ads),
 *      lenders fund them — deploying a LoanAgreement contract per loan.
 *      Parallel to the existing Microfinance contract — does NOT replace it.
 */
contract LoanAgreementFactory {
    // --- Config ---
    address public immutable identityContract;
    address public immutable treasury;
    /// @dev ERC-20 token used for installment repayments (e.g. MockUSDT / tUSDT).
    address public immutable repaymentToken;
    /// @dev Backend automation service wallet passed to every LoanAgreement it deploys.
    address public immutable automationService;
    /// @dev TrustScoreRegistry — each deployed LoanAgreement is authorized to call penalize().
    ITrustScoreRegistry public immutable trustScoreRegistry;

    /// @dev Insurance fee = 1% of totalRepayment (100 basis points)
    uint256 public constant INSURANCE_BPS = 100; // 1% in basis points (out of 10_000)

    // --- Loan Requests ---
    struct LoanRequest {
        uint256 id;
        address borrower;
        uint256 principal;
        uint256 totalRepayment;
        uint256 durationInMonths;
        bool funded;
        address agreementAddress;
        LoanAgreement.LoanMode mode;
    }

    uint256 public requestCounter;
    mapping(uint256 => LoanRequest) public loanRequests;

    // Convenience lookups per address
    mapping(address => uint256[]) public borrowerRequestIds;
    mapping(address => address[]) public borrowerAgreements;
    mapping(address => address[]) public lenderAgreements;

    // --- Events ---
    event LoanRequested(
        uint256 indexed id,
        address indexed borrower,
        uint256 principal,
        uint256 totalRepayment,
        uint256 durationInMonths,
        LoanAgreement.LoanMode mode
    );

    event LoanFunded(
        uint256 indexed id,
        address indexed lender,
        address indexed agreementAddress
    );

    // --- Modifier ---
    modifier onlyVerified() {
        require(
            IIdentity(identityContract).balanceOf(msg.sender) > 0,
            "Soulbound Identity NFT required"
        );
        _;
    }

    // --- Constructor ---
    constructor(
        address _identityContract,
        address _treasury,
        address _repaymentToken,
        address _automationService,
        address _trustScoreRegistry
    ) {
        require(_identityContract   != address(0), "Zero identity address");
        require(_treasury           != address(0), "Zero treasury address");
        require(_repaymentToken     != address(0), "Zero token address");
        require(_automationService  != address(0), "Zero automation service");
        require(_trustScoreRegistry != address(0), "Zero trust registry");
        identityContract   = _identityContract;
        treasury           = _treasury;
        repaymentToken     = _repaymentToken;
        automationService  = _automationService;
        trustScoreRegistry = ITrustScoreRegistry(_trustScoreRegistry);
    }

    // --- Core Functions ---

    /**
     * @dev Backward compatibility: creates an ETH loan.
     */
    function createLoanRequest(
        uint256 principal,
        uint256 totalRepayment,
        uint256 durationInMonths
    ) external onlyVerified {
        _createLoanRequest(principal, totalRepayment, durationInMonths, LoanAgreement.LoanMode.ETH);
    }

    /**
     * @dev Creates a loan specifying the mode (ETH or ERC20).
     */
    function createLoanRequestWithMode(
        uint256 principal,
        uint256 totalRepayment,
        uint256 durationInMonths,
        LoanAgreement.LoanMode mode
    ) external onlyVerified {
        _createLoanRequest(principal, totalRepayment, durationInMonths, mode);
    }

    function _createLoanRequest(
        uint256 principal,
        uint256 totalRepayment,
        uint256 durationInMonths,
        LoanAgreement.LoanMode mode
    ) internal {
        require(principal > 0, "Principal must be > 0");
        require(totalRepayment >= principal, "Repayment must be >= principal");
        require(durationInMonths > 0 && durationInMonths <= 36, "Duration: 1-36 months");

        requestCounter++;
        loanRequests[requestCounter] = LoanRequest({
            id: requestCounter,
            borrower: msg.sender,
            principal: principal,
            totalRepayment: totalRepayment,
            durationInMonths: durationInMonths,
            funded: false,
            agreementAddress: address(0),
            mode: mode
        });

        borrowerRequestIds[msg.sender].push(requestCounter);

        emit LoanRequested(requestCounter, msg.sender, principal, totalRepayment, durationInMonths, mode);
    }

    /**
     * @dev Lender funds a loan request. msg.value must equal the request's principal.
     *      A new LoanAgreement contract is deployed, principal forwarded to borrower.
     * @param requestId ID of the LoanRequest to fund
     */
    function fundLoanRequest(uint256 requestId) external payable onlyVerified {
        LoanRequest storage request = loanRequests[requestId];

        require(request.id != 0, "Request does not exist");
        require(!request.funded, "Already funded");
        require(msg.sender != request.borrower, "Cannot fund own loan");
        
        LoanAgreement.LoanMode mode = request.mode;
        address token = address(0);
        uint256 passedValue = 0;

        if (mode == LoanAgreement.LoanMode.ETH) {
            require(msg.value == request.principal, "Send exact principal amount");
            passedValue = msg.value;
        } else {
            require(msg.value == 0, "ERC20 mode should not receive ETH");
            token = repaymentToken;
            
            // In ERC20 mode, factory pulls tokens directly from lender to borrower
            // The lender must have approved the factory for this transfer
            require(
                IERC20(repaymentToken).transferFrom(msg.sender, request.borrower, request.principal),
                "ERC20 transfer failed"
            );
        }

        request.funded = true;

        // Deploy individual LoanAgreement
        LoanAgreement agreement = new LoanAgreement{value: passedValue}(
            mode,
            token,
            request.borrower,
            msg.sender,              // lender
            request.principal,
            request.totalRepayment,
            request.durationInMonths,
            treasury,
            INSURANCE_BPS * request.totalRepayment / 10_000,
            automationService,
            address(trustScoreRegistry)
        );

        address agreementAddr = address(agreement);
        request.agreementAddress = agreementAddr;

        // Grant this specific LoanAgreement contract permission to call
        // trustScoreRegistry.penalize() so on-chain trust penalties can fire
        // directly from the contract when a borrower's payment fails.
        // Wrapped in try/catch: succeeds if factory is owner/authorized on the
        // registry; silently skips otherwise (backend handles penalty as fallback).
        try trustScoreRegistry.setAuthorized(agreementAddr, true) {
            // LoanAgreement can now penalize on-chain
        } catch {
            // Factory not authorized on TrustScoreRegistry \u2014 backend cron handles penalties
        }

        borrowerAgreements[request.borrower].push(agreementAddr);
        lenderAgreements[msg.sender].push(agreementAddr);

        emit LoanFunded(requestId, msg.sender, agreementAddr);
    }

    // --- Backend Matching Service Functions ---

    /**
     * @dev Deploys a LoanAgreement automatically matched by the off-chain engine.
     *      Restricted strictly to the backend matching service.
     */
    function deployMatchedLoan(
        address borrower,
        address lender,
        uint256 principal,
        uint256 totalRepayment,
        uint256 durationInMonths,
        LoanAgreement.LoanMode mode
    ) external payable returns (address) {
        require(msg.sender == automationService, "Only automation service");
        require(principal > 0, "Principal must be > 0");
        require(totalRepayment >= principal, "Repayment must be >= principal");
        require(borrower != address(0) && lender != address(0), "Zero address");

        address token = address(0);
        uint256 passedValue = 0;

        if (mode == LoanAgreement.LoanMode.ETH) {
            // Backend sends ETH to proxy the lender's funding
            require(msg.value == principal, "Backend must fund ETH principal");
            passedValue = msg.value;
        } else {
            require(msg.value == 0, "No ETH for ERC20 loans");
            token = repaymentToken;
            
            // Factory orchestrates transfer from Lender -> Borrower immediately
            require(
                IERC20(repaymentToken).transferFrom(lender, borrower, principal),
                "ERC20 Factory proxy transfer failed"
            );
        }

        requestCounter++;
        address agreementAddr = address(new LoanAgreement{value: passedValue}(
            mode,
            token,
            borrower,
            lender,
            principal,
            totalRepayment,
            durationInMonths,
            treasury,
            INSURANCE_BPS * totalRepayment / 10_000,
            automationService,
            address(trustScoreRegistry)
        ));

        // Attempt TrustScoreRegistry auth mapping
        try trustScoreRegistry.setAuthorized(agreementAddr, true) {} catch {}

        loanRequests[requestCounter] = LoanRequest({
            id: requestCounter,
            borrower: borrower,
            principal: principal,
            totalRepayment: totalRepayment,
            durationInMonths: durationInMonths,
            funded: true,
            agreementAddress: agreementAddr,
            mode: mode
        });

        borrowerAgreements[borrower].push(agreementAddr);
        lenderAgreements[lender].push(agreementAddr);
        borrowerRequestIds[borrower].push(requestCounter);

        emit LoanFunded(requestCounter, lender, agreementAddr);

        return agreementAddr;
    }

    // --- View Functions ---

    /**
     * @dev Returns all loan requests (funded + unfunded). Frontend filters by status.
     */
    function getAllRequests() external view returns (LoanRequest[] memory) {
        if (requestCounter == 0) return new LoanRequest[](0);
        LoanRequest[] memory all = new LoanRequest[](requestCounter);
        for (uint256 i = 1; i <= requestCounter; i++) {
            all[i - 1] = loanRequests[i];
        }
        return all;
    }

    /**
     * @dev Returns agreement contract addresses for a borrower.
     */
    function getBorrowerAgreements(address _borrower) external view returns (address[] memory) {
        return borrowerAgreements[_borrower];
    }

    /**
     * @dev Returns agreement contract addresses for a lender.
     */
    function getLenderAgreements(address _lender) external view returns (address[] memory) {
        return lenderAgreements[_lender];
    }

    /**
     * @dev Convenience: returns a borrower's request IDs.
     */
    function getBorrowerRequestIds(address _borrower) external view returns (uint256[] memory) {
        return borrowerRequestIds[_borrower];
    }
}
