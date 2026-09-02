// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {SimpleDescriptor} from "../src/periphery/SimpleDescriptor.sol";
import {Treasury} from "../src/Treasury.sol";
import {FeeLocker} from "../src/FeeLocker.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {PriceMath} from "../src/libraries/PriceMath.sol";
import {IUniswapV3Factory, INonfungiblePositionManager, ISwapRouter, IUniswapV3Pool} from "../src/interfaces/IUniswapV3.sol";

abstract contract Base is Test {
    MockUSDC usdc;
    IUniswapV3Factory uni;
    INonfungiblePositionManager nfpm;
    ISwapRouter router;
    address quoter;

    Treasury treasury;
    FeeLocker locker;
    LaunchFactory factory;

    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");
    address eco = makeAddr("eco");

    function setUp() public virtual {
        usdc = new MockUSDC();

        // Official Uniswap V3 bytecode (v3-core 1.0.1 / v3-periphery 1.4.4).
        uni = IUniswapV3Factory(deployCode("vendor/uniswap-v3/UniswapV3Factory.json"));
        address descriptor = address(new SimpleDescriptor());
        nfpm = INonfungiblePositionManager(
            deployCode("vendor/uniswap-v3/NonfungiblePositionManager.json", abi.encode(address(uni), address(usdc), descriptor))
        );
        router = ISwapRouter(deployCode("vendor/uniswap-v3/SwapRouter.json", abi.encode(address(uni), address(usdc))));
        quoter = deployCode("vendor/uniswap-v3/QuoterV2.json", abi.encode(address(uni), address(usdc)));

        treasury = new Treasury(address(usdc), address(router), owner);
        locker = new FeeLocker(address(nfpm), address(treasury), owner);
        factory = new LaunchFactory(
            address(uni), address(nfpm), address(router), address(usdc), address(locker), address(treasury), owner
        );
        vm.prank(owner);
        locker.setFactory(address(factory));

        usdc.mint(creator, 100_000e6);
        usdc.mint(buyer, 1_000_000e6);
        vm.prank(creator);
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(creator);
        usdc.approve(address(router), type(uint256).max);
    }

    // ------------------------------------------------------------ helpers

    /// @dev Predict the token address the factory will CREATE next so we can pick the right orientation.
    function nextTokenAddress() internal view returns (address) {
        return vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));
    }

    function launchParams(string memory sym, uint256 mcapUsdc, uint256 initialBuy)
        internal
        view
        returns (LaunchFactory.LaunchParams memory p)
    {
        bool isToken0 = nextTokenAddress() < address(usdc);
        p = LaunchFactory.LaunchParams({
            name: string.concat("Token ", sym),
            symbol: sym,
            logo: "ipfs://logo",
            description: "test token",
            socials: LaunchToken.Socials({website: "", twitter: "https://x.com/t", telegram: ""}),
            sqrtPriceX96: PriceMath.sqrtPriceX96ForMcap(mcapUsdc, isToken0),
            initialBuyUsdc: initialBuy,
            minTokensOut: 0
        });
    }

    function doLaunch(address who, string memory sym, uint256 mcapUsdc, uint256 initialBuy)
        internal
        returns (address token, address pool)
    {
        LaunchFactory.LaunchParams memory p = launchParams(sym, mcapUsdc, initialBuy);
        vm.prank(who);
        (token, pool,) = factory.launch(p);
    }

    function buy(address who, address token, uint256 usdcIn) internal returns (uint256 out) {
        vm.prank(who);
        out = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(usdc),
                tokenOut: token,
                fee: 10_000,
                recipient: who,
                deadline: block.timestamp,
                amountIn: usdcIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function sell(address who, address token, uint256 tokensIn) internal returns (uint256 out) {
        vm.startPrank(who);
        LaunchToken(token).approve(address(router), tokensIn);
        out = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: address(usdc),
                fee: 10_000,
                recipient: who,
                deadline: block.timestamp,
                amountIn: tokensIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        vm.stopPrank();
    }

    function spotMcap(address token, address pool) internal view returns (uint256) {
        (uint160 sqrtP,,,,,,) = IUniswapV3Pool(pool).slot0();
        return PriceMath.mcapFromSqrtPriceX96(sqrtP, token < address(usdc));
    }
}
