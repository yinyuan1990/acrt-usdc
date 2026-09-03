// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {FeeLocker} from "./FeeLocker.sol";
import {IUniswapV3Factory, IUniswapV3Pool, INonfungiblePositionManager, ISwapRouter} from "./interfaces/IUniswapV3.sol";

/// @title LaunchFactory
/// @notice One transaction: deploy a fixed-supply token, create its USDC pool on Uniswap V3, seed the
///         entire supply as single-sided liquidity, lock the LP position forever, optionally execute the
///         creator's first buy. No bonding curve, no migration: the pool created here is the market.
contract LaunchFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- immutables
    uint24 public constant POOL_FEE = 10_000; // 1%
    int24 public constant MIN_TICK = -887_272;
    int24 public constant MAX_TICK = 887_272;
    /// @dev Creator share of swap fees, snapshotted into each lock. Immutable by design.
    uint16 public constant CREATOR_SHARE_BPS = 7_500;

    IUniswapV3Factory public immutable uniFactory;
    INonfungiblePositionManager public immutable positionManager;
    ISwapRouter public immutable router;
    address public immutable usdc;
    FeeLocker public immutable locker;
    address public immutable treasury;

    // ---------------------------------------------------------------- operational params (new launches only)
    uint256 public creationFee = 2e6; // 2 USDC
    bool public creationFeeEnabled = true;
    mapping(address => bool) public feeWaived;
    uint256 public graduationThreshold = 10_000e6; // USDC in pool
    uint256 public protectionBlocks = 20; // ~10s on Arc
    uint16 public maxHoldBps = 500; // 5%
    uint16 public maxBuyBps = 550; // 5.5%
    /// @dev |start tick| bounds: token0 orientation uses negative ticks, token1 positive.
    int24 public startTickAbsMin = 322_000; // ≈ $10M start mcap
    int24 public startTickAbsMax = 421_500; // ≈ $500 start mcap

    // ---------------------------------------------------------------- state
    struct Launch {
        address token;
        address deployer;
        address pool;
        uint256 positionId;
        bool isToken0;
        uint256 launchBlock;
        uint256 restrictionsEndBlock;
        uint256 graduationThreshold;
        uint256 initialBuyUsdc;
        bool graduated;
        bool exists;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string logo;
        string description;
        LaunchToken.Socials socials;
        uint160 sqrtPriceX96; // initial pool price, computed off-chain (see indexer/sdk)
        uint256 initialBuyUsdc; // optional first buy, pulled from msg.sender
        uint256 minTokensOut; // slippage guard for the first buy
    }

    mapping(address => Launch) public launches;
    address[] public allTokens;

    event TokenLaunched(
        address indexed token,
        address indexed deployer,
        address indexed pool,
        uint256 positionId,
        bool isToken0,
        uint256 restrictionsEndBlock,
        uint256 graduationThreshold,
        uint256 initialBuyUsdc,
        uint256 creationFeePaid
    );
    event Graduated(address indexed token, uint256 pairedUsdc, uint256 threshold);
    event ParamsUpdated();
    event FeeWaiverSet(address indexed account, bool waived);

    error StartPriceOutOfRange(int24 tick);
    error ZeroAddress();
    error NoLiquidity();
    error UnknownToken();
    error AlreadyGraduated();
    error NotGraduated();

    constructor(
        address uniFactory_,
        address positionManager_,
        address router_,
        address usdc_,
        address locker_,
        address treasury_,
        address owner_
    ) Ownable(owner_) {
        if (
            uniFactory_ == address(0) || positionManager_ == address(0) || router_ == address(0) || usdc_ == address(0)
                || locker_ == address(0) || treasury_ == address(0)
        ) revert ZeroAddress();
        uniFactory = IUniswapV3Factory(uniFactory_);
        positionManager = INonfungiblePositionManager(positionManager_);
        router = ISwapRouter(router_);
        usdc = usdc_;
        locker = FeeLocker(locker_);
        treasury = treasury_;
    }

    // ---------------------------------------------------------------- admin (affects new launches only)

    function setCreationFee(uint256 fee, bool enabled) external onlyOwner {
        creationFee = fee;
        creationFeeEnabled = enabled;
        emit ParamsUpdated();
    }

    function setFeeWaived(address account, bool waived) external onlyOwner {
        feeWaived[account] = waived;
        emit FeeWaiverSet(account, waived);
    }

    function setLaunchParams(
        uint256 graduationThreshold_,
        uint256 protectionBlocks_,
        uint16 maxHoldBps_,
        uint16 maxBuyBps_,
        int24 startTickAbsMin_,
        int24 startTickAbsMax_
    ) external onlyOwner {
        require(maxHoldBps_ <= 10_000 && maxBuyBps_ <= 10_000, "bps");
        require(startTickAbsMin_ > 0 && startTickAbsMax_ < MAX_TICK && startTickAbsMin_ < startTickAbsMax_, "ticks");
        graduationThreshold = graduationThreshold_;
        protectionBlocks = protectionBlocks_;
        maxHoldBps = maxHoldBps_;
        maxBuyBps = maxBuyBps_;
        startTickAbsMin = startTickAbsMin_;
        startTickAbsMax = startTickAbsMax_;
        emit ParamsUpdated();
    }

    // ---------------------------------------------------------------- launch

    function quoteCreationFee(address account) public view returns (uint256) {
        if (!creationFeeEnabled || feeWaived[account]) return 0;
        return creationFee;
    }

    function launch(LaunchParams calldata p) external nonReentrant returns (address token, address pool, uint256 positionId) {
        // 1) creation fee → treasury
        uint256 fee = quoteCreationFee(msg.sender);
        if (fee > 0) IERC20(usdc).safeTransferFrom(msg.sender, treasury, fee);

        // 2) token (entire supply minted to this factory)
        token = _deployToken(p);
        bool isToken0 = token < usdc;

        // 3) pool at the requested start price
        pool = uniFactory.createPool(token, usdc, POOL_FEE);
        IUniswapV3Pool(pool).initialize(p.sqrtPriceX96);
        LaunchToken(token).setPool(pool);

        // 4) + 5) single-sided range on the token side of the price, minted straight into the locker
        positionId = _mintLocked(token, pool, isToken0);
        locker.register(token, usdc, positionId, msg.sender, CREATOR_SHARE_BPS);

        // 6) optional first buy, executed inside the launch block (only the deployer may receive here)
        if (p.initialBuyUsdc > 0) _initialBuy(token, p.initialBuyUsdc, p.minTokensOut);

        uint256 endBlock = LaunchToken(token).restrictionsEndBlock();
        launches[token] = Launch({
            token: token,
            deployer: msg.sender,
            pool: pool,
            positionId: positionId,
            isToken0: isToken0,
            launchBlock: block.number,
            restrictionsEndBlock: endBlock,
            graduationThreshold: graduationThreshold,
            initialBuyUsdc: p.initialBuyUsdc,
            graduated: false,
            exists: true
        });
        allTokens.push(token);

        emit TokenLaunched(token, msg.sender, pool, positionId, isToken0, endBlock, graduationThreshold, p.initialBuyUsdc, fee);
    }

    function _deployToken(LaunchParams calldata p) internal returns (address) {
        address[] memory exempt = new address[](3);
        exempt[0] = address(locker);
        exempt[1] = address(positionManager);
        exempt[2] = treasury;
        return address(
            new LaunchToken(
                LaunchToken.Init({
                    name: p.name,
                    symbol: p.symbol,
                    logo: p.logo,
                    description: p.description,
                    socials: p.socials,
                    deployer: msg.sender,
                    protectionBlocks: protectionBlocks,
                    maxHoldBps: maxHoldBps,
                    maxBuyBps: maxBuyBps,
                    exempt: exempt
                })
            )
        );
    }

    /// @dev Range strictly on the token side of the current tick, so the mint is single-sided.
    function _range(address pool, bool isToken0) internal view returns (int24 tickLower, int24 tickUpper) {
        (, int24 tick,,,,,) = IUniswapV3Pool(pool).slot0();
        int24 spacing = IUniswapV3Pool(pool).tickSpacing();
        if (isToken0) {
            if (tick > -startTickAbsMin || tick < -startTickAbsMax) revert StartPriceOutOfRange(tick);
            tickLower = _floorTick(tick, spacing) + spacing; // first tick strictly above price
            tickUpper = _floorTick(MAX_TICK, spacing);
        } else {
            if (tick < startTickAbsMin || tick > startTickAbsMax) revert StartPriceOutOfRange(tick);
            tickLower = _ceilTick(MIN_TICK, spacing);
            tickUpper = _floorTick(tick, spacing); // last tick at/below price
        }
    }

    function _mintLocked(address token, address pool, bool isToken0) internal returns (uint256 positionId) {
        (int24 tickLower, int24 tickUpper) = _range(pool, isToken0);
        uint256 supply = LaunchToken(token).SUPPLY();
        IERC20(token).forceApprove(address(positionManager), supply);
        uint128 liquidity;
        (positionId, liquidity,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: isToken0 ? token : usdc,
                token1: isToken0 ? usdc : token,
                fee: POOL_FEE,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: isToken0 ? supply : 0,
                amount1Desired: isToken0 ? 0 : supply,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(locker),
                deadline: block.timestamp
            })
        );
        if (liquidity == 0) revert NoLiquidity();
        // rounding dust the position could not absorb
        uint256 dust = IERC20(token).balanceOf(address(this));
        if (dust > 0) IERC20(token).safeTransfer(treasury, dust);
    }

    function _initialBuy(address token, uint256 usdcIn, uint256 minOut) internal {
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), usdcIn);
        IERC20(usdc).forceApprove(address(router), usdcIn);
        router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: usdc,
                tokenOut: token,
                fee: POOL_FEE,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: usdcIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
    }

    // ---------------------------------------------------------------- graduation

    /// @notice USDC currently paired in the pool vs. the threshold snapshotted at launch.
    function graduationStatus(address token) public view returns (uint256 paired, uint256 threshold, bool graduated) {
        Launch memory l = launches[token];
        if (!l.exists) revert UnknownToken();
        paired = IERC20(usdc).balanceOf(l.pool);
        threshold = l.graduationThreshold;
        graduated = l.graduated || paired >= threshold;
    }

    /// @notice Permissionless: persist the graduated flag once the threshold is crossed (emits once).
    function markGraduated(address token) external {
        Launch storage l = launches[token];
        if (!l.exists) revert UnknownToken();
        if (l.graduated) revert AlreadyGraduated();
        uint256 paired = IERC20(usdc).balanceOf(l.pool);
        if (paired < l.graduationThreshold) revert NotGraduated();
        l.graduated = true;
        emit Graduated(token, paired, l.graduationThreshold);
    }

    function totalLaunches() external view returns (uint256) {
        return allTokens.length;
    }

    // ---------------------------------------------------------------- tick helpers

    function _floorTick(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 c = tick / spacing;
        if (tick < 0 && tick % spacing != 0) c--;
        return c * spacing;
    }

    function _ceilTick(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 f = _floorTick(tick, spacing);
        return f == tick ? f : f + spacing;
    }
}
