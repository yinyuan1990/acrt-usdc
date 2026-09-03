// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapRouter} from "./interfaces/IUniswapV3.sol";

/// @title Treasury
/// @notice Collects creation fees and the protocol share of swap fees (in USDC and in launch tokens).
///         Once the platform token is configured, `execute()` buys it with BUYBACK_BPS of the USDC
///         balance and burns it; the remainder goes to the ecosystem fund. The split is immutable.
contract Treasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BUYBACK_BPS = 8_200; // 82% buy & burn
    uint16 public constant ECO_BPS = 1_800; // 18% ecosystem / operations
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD; // Arc forbids the zero address

    address public immutable usdc;
    ISwapRouter public immutable router;

    address public platformToken;
    uint24 public platformPoolFee;
    address public ecoFund;
    uint256 public executeThreshold; // in USDC (6 decimals)
    uint256 public maxPerExecute; // TWAP: cap USDC spent per call

    uint256 public totalBoughtBack; // USDC spent on buybacks
    uint256 public totalBurned; // platform tokens burned
    uint256 public totalToEco;

    event Configured(address platformToken, uint24 poolFee, address ecoFund, uint256 threshold, uint256 maxPerExecute);
    event Executed(uint256 usdcSpent, uint256 tokensBurned, uint256 usdcToEco);
    event Converted(address indexed token, uint256 amountIn, uint256 usdcOut);

    error NotConfigured();
    error BelowThreshold();
    error ZeroAddress();

    constructor(address usdc_, address router_, address owner_) Ownable(owner_) {
        if (usdc_ == address(0) || router_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        router = ISwapRouter(router_);
    }

    /// @notice Operational parameters. The 82/18 split itself cannot be changed.
    function configure(
        address platformToken_,
        uint24 poolFee_,
        address ecoFund_,
        uint256 threshold_,
        uint256 maxPerExecute_
    ) external onlyOwner {
        if (ecoFund_ == address(0)) revert ZeroAddress();
        platformToken = platformToken_;
        platformPoolFee = poolFee_;
        ecoFund = ecoFund_;
        executeThreshold = threshold_;
        maxPerExecute = maxPerExecute_;
        emit Configured(platformToken_, poolFee_, ecoFund_, threshold_, maxPerExecute_);
    }

    function usdcBalance() public view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }

    /// @notice Permissionless. Spends up to `maxPerExecute` USDC: 82% buys & burns the platform token,
    ///         18% goes to the ecosystem fund.
    function execute(uint256 minTokensOut) external nonReentrant {
        if (platformToken == address(0) || ecoFund == address(0)) revert NotConfigured();
        uint256 bal = usdcBalance();
        if (bal < executeThreshold || bal == 0) revert BelowThreshold();
        uint256 spend = maxPerExecute > 0 && bal > maxPerExecute ? maxPerExecute : bal;

        uint256 toBuy = (spend * BUYBACK_BPS) / 10_000;
        uint256 toEco = spend - toBuy;

        IERC20(usdc).forceApprove(address(router), toBuy);
        uint256 out = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: usdc,
                tokenOut: platformToken,
                fee: platformPoolFee,
                recipient: BURN_ADDRESS,
                deadline: block.timestamp,
                amountIn: toBuy,
                amountOutMinimum: minTokensOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(usdc).safeTransfer(ecoFund, toEco);

        totalBoughtBack += toBuy;
        totalBurned += out;
        totalToEco += toEco;
        emit Executed(toBuy, out, toEco);
    }

    /// @notice Convert protocol-share launch tokens into USDC (owner-gated because of slippage).
    function convert(address token, uint24 poolFee, uint256 amountIn, uint256 minUsdcOut) external nonReentrant onlyOwner {
        IERC20(token).forceApprove(address(router), amountIn);
        uint256 out = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: usdc,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );
        emit Converted(token, amountIn, out);
    }
}
