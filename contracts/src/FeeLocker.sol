// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {INonfungiblePositionManager} from "./interfaces/IUniswapV3.sol";

/// @title FeeLocker
/// @notice Holds every launch's LP position forever and splits collected swap fees between the creator
///         and the protocol treasury. There is no function that can move a position out.
/// @dev `distribute` is permissionless; a keeper calls it on a schedule, but anyone (including the
///      creator) can trigger it. Creator payouts that revert (e.g. USDC blocklist on Arc) are parked
///      in `claimable` so a single bad address can never wedge the pool or the protocol share.
contract FeeLocker is IERC721Receiver, Ownable, ReentrancyGuard {
    struct Lock {
        uint256 tokenId;
        address token; // launch token
        address quote; // USDC
        address creator; // original deployer (immutable record)
        address payout; // where creator share is sent; changeable via CTO
        uint16 creatorShareBps; // snapshotted at launch, never changes
        bool exists;
    }

    INonfungiblePositionManager public immutable positionManager;
    address public factory;
    address public treasury;

    mapping(address token => Lock) public locks;
    /// @dev claimable[account][asset] — creator share that could not be pushed.
    mapping(address => mapping(address => uint256)) public claimable;

    event Locked(address indexed token, uint256 indexed tokenId, address indexed creator, uint16 creatorShareBps);
    event FeesDistributed(
        address indexed token,
        uint256 quoteToCreator,
        uint256 quoteToProtocol,
        uint256 tokenToCreator,
        uint256 tokenToProtocol,
        bool creatorPaid
    );
    event Claimed(address indexed account, address indexed asset, uint256 amount);
    event PayoutChanged(address indexed token, address indexed oldPayout, address indexed newPayout);
    event FactorySet(address factory);
    event TreasurySet(address treasury);

    error OnlyFactory();
    error AlreadyLocked();
    error UnknownToken();
    error NothingToClaim();
    error ZeroAddress();
    error NotCreatorOrOwner();

    constructor(address positionManager_, address treasury_, address owner_) Ownable(owner_) {
        if (positionManager_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        positionManager = INonfungiblePositionManager(positionManager_);
        treasury = treasury_;
    }

    // ------------------------------------------------------------------ admin

    /// @notice One-time wiring; the factory is deployed after the locker.
    function setFactory(address factory_) external onlyOwner {
        if (factory != address(0)) revert AlreadyLocked();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    /// @notice Community takeover / creator wallet rotation. Creator can move their own payout;
    ///         owner (multisig) can reassign when a creator has abandoned the token.
    function setPayout(address token, address newPayout) external {
        Lock storage l = locks[token];
        if (!l.exists) revert UnknownToken();
        if (msg.sender != l.payout && msg.sender != owner()) revert NotCreatorOrOwner();
        if (newPayout == address(0)) revert ZeroAddress();
        emit PayoutChanged(token, l.payout, newPayout);
        l.payout = newPayout;
    }

    // ------------------------------------------------------------------ factory hook

    /// @dev Called by the factory after it has transferred the position NFT to this contract.
    function register(address token, address quote, uint256 tokenId, address creator, uint16 creatorShareBps)
        external
    {
        if (msg.sender != factory) revert OnlyFactory();
        if (locks[token].exists) revert AlreadyLocked();
        require(positionManager.ownerOf(tokenId) == address(this), "position not held");
        locks[token] = Lock({
            tokenId: tokenId,
            token: token,
            quote: quote,
            creator: creator,
            payout: creator,
            creatorShareBps: creatorShareBps,
            exists: true
        });
        emit Locked(token, tokenId, creator, creatorShareBps);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ------------------------------------------------------------------ distribution

    /// @notice Collect accrued swap fees for `token` and split them. Anyone may call.
    function distribute(address token) external nonReentrant returns (uint256 quoteCollected, uint256 tokenCollected) {
        Lock memory l = locks[token];
        if (!l.exists) revert UnknownToken();

        (uint256 a0, uint256 a1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: l.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        bool tokenIs0 = l.token < l.quote;
        (tokenCollected, quoteCollected) = tokenIs0 ? (a0, a1) : (a1, a0);

        uint256 qCreator = (quoteCollected * l.creatorShareBps) / 10_000;
        uint256 tCreator = (tokenCollected * l.creatorShareBps) / 10_000;
        uint256 qProto = quoteCollected - qCreator;
        uint256 tProto = tokenCollected - tCreator;

        bool paid = true;
        if (qCreator > 0) paid = _push(l.quote, l.payout, qCreator) && paid;
        if (tCreator > 0) paid = _push(l.token, l.payout, tCreator) && paid;
        if (qProto > 0) _pushOrPark(l.quote, treasury, qProto);
        if (tProto > 0) _pushOrPark(l.token, treasury, tProto);

        emit FeesDistributed(token, qCreator, qProto, tCreator, tProto, paid);
    }

    /// @notice Withdraw parked amounts (only used when an automatic push failed).
    function claim(address asset) external nonReentrant {
        uint256 amt = claimable[msg.sender][asset];
        if (amt == 0) revert NothingToClaim();
        claimable[msg.sender][asset] = 0;
        require(IERC20(asset).transfer(msg.sender, amt), "transfer failed");
        emit Claimed(msg.sender, asset, amt);
    }

    /// @dev Push `amount` of `asset` to `to`; on any failure, park it as claimable. Returns whether pushed.
    function _push(address asset, address to, uint256 amount) internal returns (bool ok) {
        // low-level call so a reverting/blocklisted recipient cannot block distribution
        (bool success, bytes memory ret) = asset.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        ok = success && (ret.length == 0 || abi.decode(ret, (bool)));
        if (!ok) claimable[to][asset] += amount;
    }

    function _pushOrPark(address asset, address to, uint256 amount) internal {
        _push(asset, to, amount);
    }

    // ------------------------------------------------------------------ views

    /// @notice Fees accrued but not yet collected (from the position's `tokensOwed`), plus uncollected
    ///         growth is not included — good enough for keeper thresholds; call `distribute` to realize.
    function pendingOwed(address token) external view returns (uint256 tokenOwed, uint256 quoteOwed) {
        Lock memory l = locks[token];
        if (!l.exists) revert UnknownToken();
        (,,,,,,,,,, uint128 owed0, uint128 owed1) = positionManager.positions(l.tokenId);
        return l.token < l.quote ? (owed0, owed1) : (owed1, owed0);
    }
}
