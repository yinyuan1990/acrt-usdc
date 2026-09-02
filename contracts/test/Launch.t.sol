// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Base} from "./Base.t.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {FeeLocker} from "../src/FeeLocker.sol";
import {PriceMath} from "../src/libraries/PriceMath.sol";
import {IUniswapV3Pool} from "../src/interfaces/IUniswapV3.sol";

contract LaunchTest is Base {
    uint256 constant SUPPLY = 1_000_000_000e18;

    // ------------------------------------------------------------ launch

    function test_launch_createsPoolLocksLpAndChargesFee() public {
        uint256 treasuryBefore = usdc.balanceOf(address(treasury));
        (address token, address pool) = doLaunch(creator, "AAA", 5_000e6, 0);

        LaunchToken t = LaunchToken(token);
        assertEq(t.totalSupply(), SUPPLY);
        assertEq(t.liquidityPool(), pool);
        assertEq(uni.getPool(token, address(usdc), 10_000), pool);

        (uint256 tokenId,,,,,, bool exists) = locker.locks(token);
        assertTrue(exists);
        assertEq(nfpm.ownerOf(tokenId), address(locker));

        // whole supply is in the pool (minus dust sent to treasury)
        uint256 inPool = t.balanceOf(pool);
        uint256 dust = t.balanceOf(address(treasury));
        assertEq(inPool + dust, SUPPLY);
        assertLt(dust, 1e18, "dust should be negligible");
        assertEq(t.balanceOf(address(factory)), 0);

        // 2 USDC creation fee reached the treasury
        assertEq(usdc.balanceOf(address(treasury)) - treasuryBefore, 2e6);

        // spot mcap ≈ requested start mcap (within 1 tick ≈ 0.01% + spacing 2%)
        uint256 mcap = spotMcap(token, pool);
        assertApproxEqRel(mcap, 5_000e6, 0.03e18);
    }

    function test_launch_feeWaivedAndDisabled() public {
        vm.prank(owner);
        factory.setFeeWaived(creator, true);
        uint256 before = usdc.balanceOf(address(treasury));
        doLaunch(creator, "BBB", 5_000e6, 0);
        assertEq(usdc.balanceOf(address(treasury)), before);

        vm.prank(owner);
        factory.setFeeWaived(creator, false);
        vm.prank(owner);
        factory.setCreationFee(2e6, false);
        doLaunch(creator, "CCC", 5_000e6, 0);
        assertEq(usdc.balanceOf(address(treasury)), before);
    }

    function test_launch_initialBuyGoesToCreator() public {
        (address token,) = doLaunch(creator, "DDD", 5_000e6, 100e6);
        uint256 bal = LaunchToken(token).balanceOf(creator);
        assertGt(bal, 0);
        // 100 USDC into a $5k mcap pool: roughly 2% of supply, under the 5.5% cap
        assertLt(bal, (SUPPLY * 550) / 10_000);
    }

    function test_launch_startPriceOutOfRangeReverts() public {
        LaunchFactory.LaunchParams memory p = launchParams("EEE", 5_000e6, 0);
        bool isToken0 = nextTokenAddress() < address(usdc);
        p.sqrtPriceX96 = PriceMath.sqrtPriceX96ForMcap(100e6, isToken0); // $100 mcap: too low
        vm.prank(creator);
        vm.expectRevert();
        factory.launch(p);
    }

    /// @dev Token addresses come from the factory nonce, so orientation flips as we launch more. Ensure both work.
    function test_launch_bothOrientations() public {
        bool seen0;
        bool seen1;
        for (uint256 i; i < 40 && !(seen0 && seen1); ++i) {
            bool isToken0 = nextTokenAddress() < address(usdc);
            (address token, address pool) = doLaunch(creator, string.concat("T", vm.toString(i)), 8_000e6, 0);
            assertEq(token < address(usdc), isToken0);
            assertApproxEqRel(spotMcap(token, pool), 8_000e6, 0.03e18);
            // buy works in either orientation
            vm.roll(block.number + 30);
            uint256 out = buy(buyer, token, 50e6);
            assertGt(out, 0);
            if (isToken0) seen0 = true;
            else seen1 = true;
        }
        assertTrue(seen0 && seen1, "need both orientations covered");
    }

    // ------------------------------------------------------------ trading & price

    function test_trade_buyRaisesPriceSellLowers() public {
        (address token, address pool) = doLaunch(creator, "FFF", 5_000e6, 0);
        vm.roll(block.number + 30);
        uint256 m0 = spotMcap(token, pool);
        uint256 out = buy(buyer, token, 500e6);
        uint256 m1 = spotMcap(token, pool);
        assertGt(m1, m0);
        sell(buyer, token, out / 2);
        uint256 m2 = spotMcap(token, pool);
        assertLt(m2, m1);
        assertGt(m2, m0);
    }

    // ------------------------------------------------------------ launch protection

    function test_protection_launchBlockOnlyCreator() public {
        (address token,) = doLaunch(creator, "GGG", 5_000e6, 0);
        // same block: a stranger cannot buy
        vm.expectRevert();
        buy(buyer, token, 10e6);
        // the creator can
        uint256 out = buy(creator, token, 10e6);
        assertGt(out, 0);
    }

    function test_protection_capsDuringWindowThenLifted() public {
        (address token,) = doLaunch(creator, "HHH", 5_000e6, 0);
        vm.roll(block.number + 1);
        // 5.5% of supply at $5k mcap ≈ $275+ of USDC; buying $2,000 would exceed maxBuy
        vm.expectRevert();
        buy(buyer, token, 2_000e6);
        // small buys fine
        buy(buyer, token, 100e6);
        // accumulate past 5% hold cap → revert
        vm.expectRevert();
        buy(buyer, token, 400e6);
        // sells are never restricted
        sell(buyer, token, LaunchToken(token).balanceOf(buyer) / 2);
        // after the window everything is allowed
        vm.roll(block.number + 25);
        uint256 out = buy(buyer, token, 5_000e6);
        assertGt(out, (SUPPLY * 550) / 10_000);
    }

    // ------------------------------------------------------------ fees

    function test_fees_distributeSplits75_25() public {
        (address token,) = doLaunch(creator, "III", 5_000e6, 0);
        vm.roll(block.number + 30);
        uint256 out = buy(buyer, token, 1_000e6); // 1% fee = 10 USDC accrues to the position
        sell(buyer, token, out / 2); // token-side fee accrues too

        uint256 cU = usdc.balanceOf(creator);
        uint256 tU = usdc.balanceOf(address(treasury));
        uint256 cT = LaunchToken(token).balanceOf(creator);

        (uint256 quoteCollected, uint256 tokenCollected) = locker.distribute(token);
        assertApproxEqAbs(quoteCollected, 10e6, 2); // 1% of 1,000 USDC
        assertGt(tokenCollected, 0);

        assertEq(usdc.balanceOf(creator) - cU, (quoteCollected * 7_500) / 10_000);
        assertEq(usdc.balanceOf(address(treasury)) - tU, quoteCollected - (quoteCollected * 7_500) / 10_000);
        assertEq(LaunchToken(token).balanceOf(creator) - cT, (tokenCollected * 7_500) / 10_000);

        // second distribute with nothing new collects zero and does not revert
        (uint256 q2,) = locker.distribute(token);
        assertEq(q2, 0);
    }

    function test_fees_blocklistedCreatorParkedAsClaimable() public {
        (address token,) = doLaunch(creator, "JJJ", 5_000e6, 0);
        vm.roll(block.number + 30);
        buy(buyer, token, 1_000e6);

        usdc.setBlocked(creator, true);
        uint256 tU = usdc.balanceOf(address(treasury));
        (uint256 q,) = locker.distribute(token); // must NOT revert
        uint256 share = (q * 7_500) / 10_000;
        assertEq(locker.claimable(creator, address(usdc)), share);
        assertEq(usdc.balanceOf(address(treasury)) - tU, q - share, "protocol still paid");

        // once unblocked, creator claims
        usdc.setBlocked(creator, false);
        uint256 before = usdc.balanceOf(creator);
        vm.prank(creator);
        locker.claim(address(usdc));
        assertEq(usdc.balanceOf(creator) - before, share);
        assertEq(locker.claimable(creator, address(usdc)), 0);
    }

    function test_fees_payoutRotationAndCTO() public {
        (address token,) = doLaunch(creator, "KKK", 5_000e6, 0);
        address newWallet = makeAddr("newWallet");
        // creator moves own payout
        vm.prank(creator);
        locker.setPayout(token, newWallet);
        // stranger cannot
        vm.prank(buyer);
        vm.expectRevert();
        locker.setPayout(token, buyer);
        // owner (multisig) can reassign — community takeover
        address community = makeAddr("community");
        vm.prank(owner);
        locker.setPayout(token, community);

        vm.roll(block.number + 30);
        buy(buyer, token, 1_000e6);
        uint256 before = usdc.balanceOf(community);
        locker.distribute(token);
        assertGt(usdc.balanceOf(community) - before, 0);
    }

    function test_locker_positionCanNeverLeave() public {
        (address token,) = doLaunch(creator, "LLL", 5_000e6, 0);
        (uint256 tokenId,,,,,,) = locker.locks(token);
        // no function exists to transfer it; even the owner cannot move it via the NFT contract
        vm.prank(owner);
        vm.expectRevert();
        nfpm.safeTransferFrom(address(locker), owner, tokenId);
        assertEq(nfpm.ownerOf(tokenId), address(locker));
    }

    // ------------------------------------------------------------ graduation

    function test_graduation_flagAndEvent() public {
        vm.prank(owner);
        factory.setLaunchParams(500e6, 20, 500, 550, 322_000, 421_500); // low threshold for the test
        (address token, address pool) = doLaunch(creator, "MMM", 5_000e6, 0);

        (uint256 paired, uint256 threshold, bool graduated) = factory.graduationStatus(token);
        assertEq(threshold, 500e6);
        assertEq(paired, 0);
        assertFalse(graduated);
        vm.expectRevert(LaunchFactory.NotGraduated.selector);
        factory.markGraduated(token);

        vm.roll(block.number + 30);
        // several buyers so hold caps don't matter after the window anyway
        buy(buyer, token, 600e6);
        (paired,, graduated) = factory.graduationStatus(token);
        assertGe(paired, 500e6);
        assertTrue(graduated);
        assertEq(usdc.balanceOf(pool), paired);

        vm.expectEmit(true, false, false, false);
        emit LaunchFactory.Graduated(token, 0, 0);
        factory.markGraduated(token);
        vm.expectRevert(LaunchFactory.AlreadyGraduated.selector);
        factory.markGraduated(token);

        // trading continues in the same pool after graduation
        uint256 out = buy(buyer, token, 100e6);
        assertGt(out, 0);
    }

    // ------------------------------------------------------------ price math

    function test_priceMath_roundTrip() public pure {
        uint256[4] memory mcaps = [uint256(1_000e6), 5_000e6, 25_000e6, 1_000_000e6];
        for (uint256 i; i < mcaps.length; ++i) {
            uint160 s0 = PriceMath.sqrtPriceX96ForMcap(mcaps[i], true);
            uint160 s1 = PriceMath.sqrtPriceX96ForMcap(mcaps[i], false);
            assertApproxEqRel(PriceMath.mcapFromSqrtPriceX96(s0, true), mcaps[i], 0.001e18);
            assertApproxEqRel(PriceMath.mcapFromSqrtPriceX96(s1, false), mcaps[i], 0.001e18);
        }
    }
}
