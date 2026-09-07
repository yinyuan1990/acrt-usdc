import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "event TokenLaunched(address indexed token, address indexed deployer, address indexed pool, uint256 positionId, bool isToken0, uint256 restrictionsEndBlock, uint256 graduationThreshold, uint256 initialBuyUsdc, uint256 creationFeePaid)",
  "event Graduated(address indexed token, uint256 pairedUsdc, uint256 threshold)",
  "event ParamsUpdated()",
  "function graduationStatus(address token) view returns (uint256 paired, uint256 threshold, bool graduated)",
  "function markGraduated(address token)",
  "function creationFee() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function protectionBlocks() view returns (uint256)",
  "function maxHoldBps() view returns (uint16)",
  "function maxBuyBps() view returns (uint16)",
  "function startMcapUsdc() view returns (uint256)",
  "function maxTaxBps() view returns (uint16)",
  "function feeRecipient() view returns (address)",
  "function totalLaunches() view returns (uint256)",
  "function owner() view returns (address)",
]);

export const lockerAbi = parseAbi([
  "event Locked(address indexed token, uint256 indexed tokenId, address indexed creator, address payout, uint16 creatorShareBps)",
  "event FeesDistributed(address indexed token, uint256 quoteToCreator, uint256 quoteToProtocol, uint256 tokenConverted, uint256 usdcFromToken, bool creatorPaid)",
  "event TokenFeesDeferred(address indexed token, uint256 amount)",
  "event TaxDistributed(address indexed token, uint256 tokenConverted, address marketingWallet, uint256 usdcToMarketing, address teamWallet, uint256 usdcToTeam, bool allPaid)",
  "event Claimed(address indexed account, address indexed asset, uint256 amount)",
  "event PayoutChanged(address indexed token, address indexed oldPayout, address indexed newPayout)",
  "event PayoutProposed(address indexed token, address indexed proposed, uint64 eta)",
  "event PayoutProposalCancelled(address indexed token, address indexed by)",
  "function distribute(address token, uint256 minUsdcOut) returns (uint256 usdcCollected, uint256 usdcFromToken)",
  "function claimable(address account, address asset) view returns (uint256)",
  "function unconvertedTokenFees(address token) view returns (uint256)",
  "function pendingPayout(address token) view returns (address newPayout, uint64 eta)",
  "function locks(address token) view returns (uint256 tokenId, address token_, address quote, address pool, address creator, address payout, uint16 creatorShareBps, bool exists)",
  "function owner() view returns (address)",
  "function treasury() view returns (address)",
]);

export const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function logo() view returns (string)",
  "function description() view returns (string)",
  "function socials() view returns (string website, string twitter, string telegram, string discord, string farcaster)",
  "function taxConfig() view returns (uint16 buyBps, uint16 sellBps, address marketing, address team, uint16 marketingShareBps)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const poolAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

export const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export const treasuryAbi = parseAbi([
  "event Executed(uint256 usdcToEco, uint256 usdcToDev, uint256 usdcSpent, uint256 tokensBurned, uint256 reserveLeft)",
  "event BoughtBack(uint256 usdcSpent, uint256 tokensBurned, uint256 reserveLeft)",
  "event Configured(address platformToken, uint24 poolFee, address pool)",
  "function execute(uint256 minTokensOut)",
  "function buyback(uint256 minTokensOut)",
  "function usdcBalance() view returns (uint256)",
  "function lastExecutedAt() view returns (uint256)",
  "function nextExecuteAt() view returns (uint256)",
  "function nextBuybackAt() view returns (uint256)",
  "function nextBuybackAmount() view returns (uint256)",
  "function BUYBACK_COOLDOWN() view returns (uint256)",
  "function pendingRevenue() view returns (uint256)",
  "function buybackReserve() view returns (uint256)",
  "function INTERVAL() view returns (uint256)",
  "function platformToken() view returns (address)",
  "function platformPoolFee() view returns (uint24)",
  "function ecoFund() view returns (address)",
  "function devFund() view returns (address)",
  "function totalBoughtBack() view returns (uint256)",
  "function totalBurned() view returns (uint256)",
  "function totalToEco() view returns (uint256)",
  "function totalToDev() view returns (uint256)",
  "function owner() view returns (address)",
]);

export const quoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
