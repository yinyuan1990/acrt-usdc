import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "event TokenLaunched(address indexed token, address indexed deployer, address indexed pool, uint256 positionId, bool isToken0, uint256 restrictionsEndBlock, uint256 graduationThreshold, uint256 initialBuyUsdc, uint256 creationFeePaid)",
  "event Graduated(address indexed token, uint256 pairedUsdc, uint256 threshold)",
  "event ParamsUpdated()",
  "function graduationStatus(address token) view returns (uint256 paired, uint256 threshold, bool graduated)",
  "function markGraduated(address token)",
  "function creationFee() view returns (uint256)",
  "function creationFeeEnabled() view returns (bool)",
  "function quoteCreationFee(address) view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function protectionBlocks() view returns (uint256)",
  "function maxHoldBps() view returns (uint16)",
  "function maxBuyBps() view returns (uint16)",
  "function totalLaunches() view returns (uint256)",
]);

export const lockerAbi = parseAbi([
  "event Locked(address indexed token, uint256 indexed tokenId, address indexed creator, uint16 creatorShareBps)",
  "event FeesDistributed(address indexed token, uint256 quoteToCreator, uint256 quoteToProtocol, uint256 tokenToCreator, uint256 tokenToProtocol, bool creatorPaid)",
  "event Claimed(address indexed account, address indexed asset, uint256 amount)",
  "event PayoutChanged(address indexed token, address indexed oldPayout, address indexed newPayout)",
  "function distribute(address token) returns (uint256 quoteCollected, uint256 tokenCollected)",
  "function claimable(address account, address asset) view returns (uint256)",
  "function locks(address token) view returns (uint256 tokenId, address token_, address quote, address creator, address payout, uint16 creatorShareBps, bool exists)",
]);

export const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function logo() view returns (string)",
  "function description() view returns (string)",
  "function socials() view returns (string website, string twitter, string telegram)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const poolAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

export const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export const treasuryAbi = parseAbi([
  "event Executed(uint256 usdcSpent, uint256 tokensBurned, uint256 usdcToEco)",
  "event Configured(address platformToken, uint24 poolFee, address ecoFund, uint256 threshold, uint256 maxPerExecute)",
  "function execute(uint256 minTokensOut)",
  "function usdcBalance() view returns (uint256)",
  "function executeThreshold() view returns (uint256)",
  "function maxPerExecute() view returns (uint256)",
  "function platformToken() view returns (address)",
  "function platformPoolFee() view returns (uint24)",
  "function ecoFund() view returns (address)",
  "function totalBoughtBack() view returns (uint256)",
  "function totalBurned() view returns (uint256)",
  "function totalToEco() view returns (uint256)",
]);

export const quoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
