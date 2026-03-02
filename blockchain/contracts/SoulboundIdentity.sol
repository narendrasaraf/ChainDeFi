// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SoulboundIdentity
 * @dev Implementation of a Soulbound (non-transferable) NFT for Identity Verification.
 * This contract ensures that each wallet can hold at most one identity NFT and that
 * the NFT cannot be transferred to another wallet once issued.
 */
contract SoulboundIdentity is ERC721, Ownable {
    uint256 private _nextTokenId;

    // Custom errors for gas efficiency and clarity
    error Soulbound_NoTransferAllowed();
    error Soulbound_AlreadyHasIdentity();
    error Soulbound_IdentityDoesNotExist();

    /**
     * @dev Constructor initializes the ERC721 token with a name and symbol.
     * @param initialOwner Address of the owner who can mint new identities.
     */
    constructor(address initialOwner) ERC721("Soulbound Identity", "ID") Ownable(initialOwner) {
        _nextTokenId = 1; // Start IDs from 1
    }

    /**
     * @dev Mints a new Identity NFT to the caller.
     * Requirements:
     * - The user must not already own an identity NFT.
     */
    function mintIdentity() public {
        address user = msg.sender;
        // Enforce "one identity per wallet" rule
        if (balanceOf(user) > 0) {
            revert Soulbound_AlreadyHasIdentity();
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(user, tokenId);
    }

    /**
     * @dev Overrides the Internal _update function (OZ 5.x) to block transfers.
     * In OpenZeppelin 5.x, _update handles minting, burning, and transfers.
     * Logic:
     * - If from is address(0), it's a mint (Allowed).
     * - If to is address(0), it's a burn (Allowed).
     * - Otherwise, it's a transfer (Blocked).
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // If it's not a mint (from == 0) and not a burn (to == 0), revert
        if (from != address(0) && to != address(0)) {
            revert Soulbound_NoTransferAllowed();
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Disables the approval mechanism to prevent listed transfers on marketplaces.
     */
    function approve(address /* to */, uint256 /* tokenId */) public pure override {
        revert Soulbound_NoTransferAllowed();
    }

    /**
     * @dev Disables operator-based approvals.
     */
    function setApprovalForAll(address /* operator */, bool /* approved */) public pure override {
        revert Soulbound_NoTransferAllowed();
    }

    /**
     * @dev Required override for tokenURI if using dynamic or IPFS-based metadata.
     * For a hackathon, this can be extended to point to an identity profile.
     */
    function _baseURI() internal pure override returns (string memory) {
        return "https://api.aamba.io/identity/";
    }
}
