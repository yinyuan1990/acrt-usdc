import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { arcTestnet } from "viem/chains";
import { parseAbi, type Address } from "viem";
import deployments from "./deployments.arc-testnet.json";

export const chain = arcTestnet;
export const EXPLORER = chain.blockExplorers?.default.url ?? "https://testnet.arcscan.app";

export const ADDR = {
  usdc: deployments.usdc as Address,
  factory: deployments.launchFactory as Address,
  locker: deployments.feeLocker as Address,
  treasury: deployments.treasury as Address,
  router: deployments.swapRouter as Address,
  quoter: deployments.quoterV2 as Address,
  positionManager: deployments.positionManager as Address,
};

export const POOL_FEE = 10_000;
export const SUPPLY_TOKENS = 1_000_000_000;

// WalletConnect needs a (free) project id from dashboard.reown.com; enabled only when provided.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [chain],
  // EIP-6963 discovery (default on) adds every installed browser wallet as its own connector.
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "ArcLaunch", preference: "all" }),
    ...(WC_PROJECT_ID ? [walletConnect({ projectId: WC_PROJECT_ID, showQrModal: true, metadata: { name: "ArcLaunch", description: "Launch tokens on Arc, settled in USDC", url: "https://launch.hzmrbq.com", icons: [] } })] : []),
  ],
  transports: { [chain.id]: http(chain.rpcUrls.default.http[0]) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]);

export const factoryAbi = parseAbi([
  "struct Socials { string website; string twitter; string telegram; }",
  "struct LaunchParams { string name; string symbol; string logo; string description; Socials socials; uint160 sqrtPriceX96; uint256 initialBuyUsdc; uint256 minTokensOut; }",
  "function launch(LaunchParams p) returns (address token, address pool, uint256 positionId)",
  "function quoteCreationFee(address account) view returns (uint256)",
  "function graduationStatus(address token) view returns (uint256 paired, uint256 threshold, bool graduated)",
  "event TokenLaunched(address indexed token, address indexed deployer, address indexed pool, uint256 positionId, bool isToken0, uint256 restrictionsEndBlock, uint256 graduationThreshold, uint256 initialBuyUsdc, uint256 creationFeePaid)",
]);

export const routerAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);

export const quoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export const lockerAbi = parseAbi([
  "function claimable(address account, address asset) view returns (uint256)",
  "function claim(address asset)",
  "function distribute(address token) returns (uint256 quoteCollected, uint256 tokenCollected)",
  "function setPayout(address token, address newPayout)",
]);

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;
