// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract HotERC20 is ERC20, EIP712 {
    event SetEmergencyWithdrawAddress(
        address owner,
        address emergencyWithdrawAddress
    );
    event EmergencyWithdraw(
        address owner,
        address emergencyWithdrawAddress,
        uint256 amount,
        uint256 timestamp
    );

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private constant _EMERGENCY_WITHDRAW_TYPEHASH =
        keccak256("EmergencyWithdraw(address owner,uint256 deadline)");

    mapping(address => bool) public isBlacklisted;
    mapping(address => address) public emergencyWithdrawAddresses;

    constructor(uint256 supply)
        EIP712("HotERC20", "1")
        ERC20("HotERC20", "HOT")
    {
        _mint(msg.sender, supply * (10**18));
    }

    modifier notBlacklisted(address owner) {
        require(!isBlacklisted[owner], "HotERC20: blacklisted");
        _;
    }

    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice set emergency withdraw address
    /// @dev check if blacklisted addresses are provided
    /// @param emergencyWithdrawAddress emergency withdraw address
    function setEmergencyWithdrawAddress(address emergencyWithdrawAddress)
        external
        notBlacklisted(msg.sender)
        notBlacklisted(emergencyWithdrawAddress)
    {
        emergencyWithdrawAddresses[msg.sender] = emergencyWithdrawAddress;

        emit SetEmergencyWithdrawAddress(msg.sender, emergencyWithdrawAddress);
    }

    function emergencyWithdraw(
        address owner,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external notBlacklisted(owner) {
        require(block.timestamp <= deadline, "HotERC20: expired signature");

        bytes32 structHash = keccak256(
            abi.encode(_EMERGENCY_WITHDRAW_TYPEHASH, owner, deadline)
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);

        require(signer == owner, "HotERC20: invalid signature");

        address emergencyWithdrawAddress = emergencyWithdrawAddresses[owner];

        uint256 amount = balanceOf(owner);
        // if emergency withdraw address is not set, then it will be reverted in _transfer() function
        _transfer(owner, emergencyWithdrawAddress, amount);

        isBlacklisted[owner] = true;

        emit EmergencyWithdraw(
            owner,
            emergencyWithdrawAddress,
            amount,
            block.timestamp
        );
    }

    /// @notice transfer amount of tokens
    /// @dev transfer tokens to emergency withdraw address if recipient is blacklisted
    /// @param from sender address
    /// @param to recipient address
    /// @param amount amount of tokens to send
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override notBlacklisted(from) {
        if (isBlacklisted[to]) {
            _transfer(from, emergencyWithdrawAddresses[to], amount);
        } else {
            ERC20._transfer(from, to, amount);
        }
    }
}
