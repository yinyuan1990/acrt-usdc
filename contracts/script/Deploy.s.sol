// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SimpleDescriptor} from "../src/periphery/SimpleDescriptor.sol";
import {Treasury} from "../src/Treasury.sol";
import {FeeLocker} from "../src/FeeLocker.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";

/// Deploys our own Uniswap V3 (official bytecode) plus the ArcLaunch contracts.
///   USDC     — native USDC ERC-20 interface on Arc: 0x3600000000000000000000000000000000000000
///   OWNER    — admin (defaults to deployer); move to a Safe multisig before mainnet
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdc = vm.envOr("USDC", address(0x3600000000000000000000000000000000000000));
        address owner = vm.envOr("OWNER", deployer);
        string memory outFile = vm.envOr("OUT_FILE", string("deployments/arc-testnet.json"));

        vm.startBroadcast(pk);

        address uniFactory = deployCode("vendor/uniswap-v3/UniswapV3Factory.json");
        address descriptor = address(new SimpleDescriptor());
        address nfpm =
            deployCode("vendor/uniswap-v3/NonfungiblePositionManager.json", abi.encode(uniFactory, usdc, descriptor));
        address router = deployCode("vendor/uniswap-v3/SwapRouter.json", abi.encode(uniFactory, usdc));
        address quoter = deployCode("vendor/uniswap-v3/QuoterV2.json", abi.encode(uniFactory, usdc));

        Treasury treasury = new Treasury(usdc, router, owner);
        FeeLocker locker = new FeeLocker(nfpm, address(treasury), owner);
        LaunchFactory factory =
            new LaunchFactory(uniFactory, nfpm, router, usdc, address(locker), address(treasury), owner);
        // owner == deployer for the testnet run; on mainnet the Safe calls setFactory.
        if (owner == deployer) locker.setFactory(address(factory));

        vm.stopBroadcast();

        string memory j = "d";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeAddress(j, "deployer", deployer);
        vm.serializeAddress(j, "owner", owner);
        vm.serializeAddress(j, "usdc", usdc);
        vm.serializeAddress(j, "uniswapV3Factory", uniFactory);
        vm.serializeAddress(j, "positionManager", nfpm);
        vm.serializeAddress(j, "swapRouter", router);
        vm.serializeAddress(j, "quoterV2", quoter);
        vm.serializeAddress(j, "treasury", address(treasury));
        vm.serializeAddress(j, "feeLocker", address(locker));
        vm.serializeUint(j, "deployBlock", block.number);
        string memory out = vm.serializeAddress(j, "launchFactory", address(factory));
        vm.writeJson(out, outFile);

        console2.log("UniswapV3Factory ", uniFactory);
        console2.log("PositionManager  ", nfpm);
        console2.log("SwapRouter       ", router);
        console2.log("QuoterV2         ", quoter);
        console2.log("Treasury         ", address(treasury));
        console2.log("FeeLocker        ", address(locker));
        console2.log("LaunchFactory    ", address(factory));
    }
}
