// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ── Minimal interface for TrustScoreRegistry ──────────────────────────────────
interface ITrustScoreRegistry {
    function penalize(address user, uint256 amount) external;
    function setAuthorized(address addr, bool status) external;
}

contract LoanAgreement is ReentrancyGuard {

    // ── Constants & Enums ──────────────────────────────────────────────────────
    uint256 public constant REPAYMENT_INTERVAL = 1 minutes;
    uint256 public constant GRACE_PERIOD       = 30 seconds;
    uint256 public constant PENALTY_POINTS     = 50;

    enum LoanStatus { Active, Completed, Defaulted }
    enum LoanMode { ETH, ERC20 }

    // ── Immutables ─────────────────────────────────────────────────────────────
    LoanMode public immutable loanMode;
    address public immutable borrower;
    address public immutable lender;
    address public immutable treasury;

    address              public immutable token;
    ITrustScoreRegistry  public immutable trustRegistry;
    address              public immutable automationService;

    uint256 public immutable principal;
    uint256 public immutable totalRepayment;
    uint256 public immutable durationInMonths;
    uint256 public immutable monthlyPayment;
    uint256 public immutable insuranceFeePerInstallment;

    // ── Mutable State ──────────────────────────────────────────────────────────
    uint256 public paymentsMade;
    uint256 public nextDueTimestamp;
    uint256 public missedPayments;
    
    // Legacy support for frontend mapping
    bool public completed; 
    bool public defaulted;
    bool public isPaused;

    // ── Events ─────────────────────────────────────────────────────────────────
    event LoanModeSelected(address indexed borrower, LoanMode mode);

    event InstallmentPaid(
        address indexed borrower,
        uint256 indexed installmentNumber,
        uint256 amountPaid,
        uint256 lenderAmount,
        uint256 insuranceCut,
        uint256 timestamp
    );

    event LoanCompleted(address indexed borrower, address indexed lender, uint256 timestamp);
    
    event LoanDefaulted(address indexed borrower, address indexed lender, uint256 timestamp);

    event InstallmentMissed(
        address indexed borrower,
        uint256 cyclesMissed,
        bool    paymentFailed,
        uint256 timestamp
    );

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(
        LoanMode _mode,
        address _token,
        address _borrower,
        address _lender,
        uint256 _principal,
        uint256 _totalRepayment,
        uint256 _durationInMonths,
        address _treasury,
        uint256 _insuranceFee,
        address _automationService,
        address _trustRegistry
    ) payable {
        if (_mode == LoanMode.ETH) {
            require(_token == address(0), "ETH mode must have zero token address");
            require(msg.value == _principal, "Must forward exact principal");
        } else {
            require(_token != address(0), "ERC20 mode requires token address");
            require(msg.value == 0, "ERC20 mode should not receive ETH");
        }

        require(_borrower          != address(0), "Zero borrower");
        require(_lender            != address(0), "Zero lender");
        require(_treasury          != address(0), "Zero treasury");
        require(_automationService != address(0), "Zero admin");
        require(_trustRegistry     != address(0), "Zero trust registry");
        require(_durationInMonths  > 0,           "Invalid duration");
        require(_totalRepayment    >= _principal, "Repayment < principal");

        loanMode          = _mode;
        borrower          = _borrower;
        lender            = _lender;
        treasury          = _treasury;
        token             = _token;
        trustRegistry     = ITrustScoreRegistry(_trustRegistry);
        automationService = _automationService;
        principal         = _principal;
        totalRepayment    = _totalRepayment;
        durationInMonths  = _durationInMonths;
        monthlyPayment    = _totalRepayment / _durationInMonths;
        insuranceFeePerInstallment = _insuranceFee / _durationInMonths;

        nextDueTimestamp = block.timestamp + REPAYMENT_INTERVAL;

        if (loanMode == LoanMode.ETH) {
            // Forward ETH principal to borrower
            (bool ok, ) = payable(_borrower).call{value: msg.value}("");
            require(ok, "Principal transfer failed");
        }
        // In ERC20 mode, the Factory handles the transfer directly

        emit LoanModeSelected(borrower, loanMode);
    }

    // ── Emergency Admin ────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == automationService || msg.sender == treasury, "Not admin");
        _;
    }

    function pauseLoan() external onlyAdmin {
        isPaused = true;
    }

    function unpauseLoan() external onlyAdmin {
        isPaused = false;
    }

    // ── Core Repayment ─────────────────────────────────────────────────────────

    function repayInstallment() external nonReentrant {
        require(loanMode == LoanMode.ERC20, "Autopay not supported for ETH loans");
        require(msg.sender == borrower || msg.sender == automationService || msg.sender == lender, "Not authorized");
        
        _checkAndAdvanceState();
        if (defaulted) return;

        uint256 insuranceCut = insuranceFeePerInstallment;
        uint256 lenderAmount = monthlyPayment - insuranceCut;

        // ERC20 mode
        bool transferOk = _tryTransferFrom(borrower, lender, lenderAmount);
        if (transferOk && insuranceCut > 0) {
            _tryTransferFrom(borrower, treasury, insuranceCut);
        }

        _finalizeRepayment(transferOk, lenderAmount, insuranceCut);
    }

    function repayETH() external payable nonReentrant {
        require(loanMode == LoanMode.ETH, "Use repayInstallment for ERC20 loans");
        require(msg.sender == borrower || msg.sender == lender, "Not authorized");
        
        _checkAndAdvanceState();
        if (defaulted) {
            // Refund accidentally sent ETH if loan defaulted during this call (from overdue)
            if (msg.value > 0) {
                (bool refundOk, ) = payable(msg.sender).call{value: msg.value}("");
                require(refundOk, "Refund failed");
            }
            return;
        }

        require(msg.value >= monthlyPayment, "Insufficient ETH sent");

        uint256 insuranceCut = insuranceFeePerInstallment;
        uint256 lenderAmount = monthlyPayment - insuranceCut;

        bool transferOk = true;
        
        // Transfer ETH to lender
        (bool lenderOk, ) = payable(lender).call{value: lenderAmount}("");
        if (!lenderOk) transferOk = false;
        
        // Transfer ETH to treasury
        if (insuranceCut > 0 && transferOk) {
            (bool treasuryOk, ) = payable(treasury).call{value: insuranceCut}("");
            if (!treasuryOk) transferOk = false;
        }
        
        // Refund ETH appropriately
        if (transferOk) {
            if (msg.value > monthlyPayment) {
                (bool refundOk, ) = payable(msg.sender).call{value: msg.value - monthlyPayment}("");
                require(refundOk, "Refund failed");
            }
        } else {
            // Unwind ETH back to sender
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value}("");
            require(refundOk, "Refund failed");
        }

        _finalizeRepayment(transferOk, lenderAmount, insuranceCut);
    }

    function _checkAndAdvanceState() internal {
        require(!isPaused, "Loan is paused");
        require(!completed, "Loan already completed");
        require(!defaulted, "Loan is defaulted");
        require(paymentsMade < durationInMonths, "All payments already made");
        require(block.timestamp >= nextDueTimestamp, "Not due yet");

        // Detect overdue cycles
        uint256 overdueBy = block.timestamp - nextDueTimestamp;
        if (overdueBy > GRACE_PERIOD) {
            uint256 lateCycles = (overdueBy - GRACE_PERIOD) / REPAYMENT_INTERVAL;
            if (lateCycles > 0) {
                missedPayments += lateCycles;
                emit InstallmentMissed(borrower, lateCycles, false, block.timestamp);
            }
        }

        if (missedPayments > 3) {
            defaulted = true;
            emit LoanDefaulted(borrower, lender, block.timestamp);
            return; // don't advance timestamp if defaulted
        }

        // Advance timestamp
        nextDueTimestamp += REPAYMENT_INTERVAL;
    }

    function _finalizeRepayment(bool transferOk, uint256 lenderAmount, uint256 insuranceCut) internal {
        if (!transferOk) {
            missedPayments++;
            emit InstallmentMissed(borrower, 1, true, block.timestamp);
            
            if (missedPayments > 3) {
                defaulted = true;
                emit LoanDefaulted(borrower, lender, block.timestamp);
            }

            // On-chain trust penalty 
            try trustRegistry.penalize(borrower, PENALTY_POINTS) {} catch {}
            return;
        }

        paymentsMade++;
        emit InstallmentPaid(borrower, paymentsMade, monthlyPayment, lenderAmount, insuranceCut, block.timestamp);

        if (paymentsMade == durationInMonths) {
            completed = true;
            emit LoanCompleted(borrower, lender, block.timestamp);
        }
    }

    function _tryTransferFrom(address from, address to, uint256 amount) internal returns (bool) {
        try IERC20(token).transferFrom(from, to, amount) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    // ── User Required View Functions ───────────────────────────────────────────

    function getRemainingBalance() external view returns (uint256) {
        return (durationInMonths - paymentsMade) * monthlyPayment;
    }

    function getNextDueDate() external view returns (uint256) {
        return nextDueTimestamp;
    }

    function getInstallmentAmount() external view returns (uint256) {
        return monthlyPayment;
    }

    function getMissedPayments() external view returns (uint256) {
        return missedPayments;
    }

    function getLoanStatus() external view returns (LoanStatus) {
        if (completed) return LoanStatus.Completed;
        if (defaulted || missedPayments > 3) return LoanStatus.Defaulted;
        return LoanStatus.Active;
    }

    function getLoanMode() external view returns (LoanMode) {
        return loanMode;
    }

    // ── Legacy Status (Maintains Frontend compatibility) ───────────────────────

    function getStatus() external view returns (
        uint256 _paymentsMade,
        uint256 _totalDuration,
        uint256 _nextDueTimestamp,
        uint256 _monthlyPayment,
        uint256 _remainingPayments,
        bool    _completed,
        uint256 _missedPayments,
        bool    _isOverdue,
        uint256 _borrowerAllowance
    ) {
        return (
            paymentsMade,
            durationInMonths,
            nextDueTimestamp,
            monthlyPayment,
            durationInMonths - paymentsMade,
            completed,
            missedPayments,
            !completed && block.timestamp > nextDueTimestamp + GRACE_PERIOD,
            loanMode == LoanMode.ERC20 ? IERC20(token).allowance(borrower, address(this)) : 0
        );
    }
}
