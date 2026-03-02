// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustScoreRegistry
 * @dev Stores and manages AI-generated trust scores for users.
 * This contract acts as an on-chain repository for reputational data,
 * where only the authorized owner (e.g., an AI backend or DAO) can update scores.
 */
contract TrustScoreRegistry is Ownable {
    
    // Mapping from user address to their trust score (0-1000 scale recommended)
    mapping(address => uint256) private _trustScores;

    // Event emitted whenever a trust score is updated
    event TrustScoreUpdated(address indexed user, uint256 oldScore, uint256 newScore);

    // Custom errors for gas efficiency
    error TrustScore_InvalidScore(uint256 score);

    mapping(address => bool) public authorized;

    /**
     * @dev Constructor sets the initial owner of the registry.
     * @param initialOwner The address that will have permission to update scores.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        authorized[initialOwner] = true;
    }

    modifier onlyAuthorized() {
        require(owner() == msg.sender || authorized[msg.sender], "Not authorized");
        _;
    }

    /**
     * @dev Authorize or deauthorize a contract/address.
     */
    function setAuthorized(address addr, bool status) external onlyOwner {
        authorized[addr] = status;
    }

    /**
     * @dev Updates the trust score for a specific user.
     * Requirements:
     * - Only the contract owner can call this.
     * - Score must be within the valid range (e.g., 0 to 1000).
     * @param user The address of the user.
     * @param score The new trust score to assign.
     */
    function updateTrustScore(address user, uint256 score) public onlyAuthorized {
        // Validation: Assuming a max score of 1000 for granularity (100.0%)
        if (score > 1000) {
            revert TrustScore_InvalidScore(score);
        }

        uint256 oldScore = _trustScores[user];
        _trustScores[user] = score;

        emit TrustScoreUpdated(user, oldScore, score);
    }

    /**
     * @dev Increments the trust score for a specific user by a fixed reward.
     * @param user The address of the user.
     */
    function increment(address user) external onlyAuthorized {
        uint256 currentScore = _trustScores[user];
        uint256 newScore = currentScore + 25;
        if (newScore > 1000) newScore = 1000;
        updateTrustScore(user, newScore);
    }

    /**
     * @dev Penalises a user's trust score by a fixed amount.
     *      Used by LoanAgreement contracts (granted via setAuthorized) when a
     *      repayment fails due to insufficient balance or allowance.
     * @param user   The address of the delinquent borrower.
     * @param amount Score points to subtract (floored at 0 — never goes negative).
     */
    function penalize(address user, uint256 amount) external onlyAuthorized {
        uint256 current  = _trustScores[user];
        uint256 newScore = current > amount ? current - amount : 0;
        updateTrustScore(user, newScore);
    }

    /**
     * @dev Retrieves the current trust score for a user.
     * @param user The address of the user.
     * @return The current trust score.
     */
    function getTrustScore(address user) external view returns (uint256) {
        return _trustScores[user];
    }
}
