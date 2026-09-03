// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LaunchToken
/// @notice Fixed-supply ERC20 with on-chain metadata and a short anti-snipe window after launch.
/// @dev Restrictions only apply to transfers *out of the pool* (i.e. buys). Sells and wallet-to-wallet
///      transfers are never restricted. Everything is lifted once `restrictionsEndBlock` passes.
contract LaunchToken is ERC20 {
    struct Socials {
        string website;
        string twitter;
        string telegram;
    }

    uint256 public constant SUPPLY = 1_000_000_000e18;

    address public immutable factory;
    address public immutable deployer;
    string public logo;
    string public description;
    Socials private _socials;

    address public liquidityPool;
    uint256 public immutable launchBlock;
    uint256 public immutable restrictionsEndBlock;
    /// @dev Basis points of SUPPLY. 10_000 = 100%.
    uint16 public immutable maxHoldBps;
    uint16 public immutable maxBuyBps;

    /// @dev Addresses that may receive from the pool during the launch block (creator's initial buy)
    ///      and are never subject to hold caps (factory, locker, position manager).
    mapping(address => bool) public exempt;

    event PoolSet(address indexed pool);

    error OnlyFactory();
    error PoolAlreadySet();
    error ZeroAddress();
    error LaunchBlockOnlyCreator();
    error ExceedsMaxBuy();
    error ExceedsMaxHold();

    struct Init {
        string name;
        string symbol;
        string logo;
        string description;
        Socials socials;
        address deployer;
        uint256 protectionBlocks;
        uint16 maxHoldBps;
        uint16 maxBuyBps;
        address[] exempt;
    }

    constructor(Init memory i) ERC20(i.name, i.symbol) {
        factory = msg.sender;
        deployer = i.deployer;
        logo = i.logo;
        description = i.description;
        _socials = i.socials;
        launchBlock = block.number;
        restrictionsEndBlock = block.number + i.protectionBlocks;
        maxHoldBps = i.maxHoldBps;
        maxBuyBps = i.maxBuyBps;
        for (uint256 k; k < i.exempt.length; ++k) exempt[i.exempt[k]] = true;
        exempt[msg.sender] = true;
        _mint(msg.sender, SUPPLY);
    }

    function socials() external view returns (string memory website, string memory twitter, string memory telegram) {
        return (_socials.website, _socials.twitter, _socials.telegram);
    }

    /// @notice Set once by the factory right after the pool is created.
    function setPool(address pool) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (liquidityPool != address(0)) revert PoolAlreadySet();
        if (pool == address(0)) revert ZeroAddress();
        liquidityPool = pool;
        exempt[pool] = true;
        emit PoolSet(pool);
    }

    function restrictionsActive() public view returns (bool) {
        return block.number <= restrictionsEndBlock;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Buys = tokens leaving the pool. Only these are guarded, and only during the window.
        if (from == liquidityPool && from != address(0) && !exempt[to] && block.number <= restrictionsEndBlock) {
            if (block.number == launchBlock && to != deployer) revert LaunchBlockOnlyCreator();
            if (value > (SUPPLY * maxBuyBps) / 10_000) revert ExceedsMaxBuy();
            if (balanceOf(to) + value > (SUPPLY * maxHoldBps) / 10_000) revert ExceedsMaxHold();
        }
        super._update(from, to, value);
    }
}
