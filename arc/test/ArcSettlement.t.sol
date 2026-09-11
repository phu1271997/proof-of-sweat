// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArcSettlement} from "../src/ArcSettlement.sol";

contract ArcSettlementTest is Test {
    ArcSettlement s;
    address client = address(0xC1);
    address worker = address(0x77);
    address relayer = address(0xEE); // the settlement oracle

    function setUp() public {
        s = new ArcSettlement(); // this test contract is owner + oracle
        s.setOracle(relayer);
        vm.deal(client, 100 ether);
        vm.deal(worker, 100 ether);
    }

    function _post() internal returns (uint256 id) {
        vm.prank(client);
        id = s.postBounty{value: 5 ether}("Write-up", "Original note", 1 ether);
    }

    function _claimSubmit(uint256 id) internal {
        vm.prank(worker);
        s.claim{value: 1 ether}(id);
        vm.prank(worker);
        s.submit(id, "https://example.com/work");
    }

    function testGenuinePaysWorker() public {
        uint256 id = _post();
        _claimSubmit(id);

        vm.prank(relayer);
        s.settle(id, ArcSettlement.Verdict.Genuine, 95, 90, "specific first-hand detail");

        // worker is credited reward + own stake = 6 ether
        assertEq(s.creditOf(worker), 6 ether);
        assertEq(s.creditOf(client), 0);

        uint256 before = worker.balance;
        vm.prank(worker);
        s.withdraw();
        assertEq(worker.balance, before + 6 ether);
        assertEq(s.creditOf(worker), 0);

        ArcSettlement.Bounty memory b = s.getBounty(id);
        assertEq(uint256(b.status), uint256(ArcSettlement.Status.Approved));
    }

    function testFraudRefundsClientAndSlashesStake() public {
        uint256 id = _post();
        _claimSubmit(id);

        vm.prank(relayer);
        s.settle(id, ArcSettlement.Verdict.AiGenerated, 88, 40, "hollow boilerplate");

        // client gets reward back + the slashed worker stake = 6 ether
        assertEq(s.creditOf(client), 6 ether);
        assertEq(s.creditOf(worker), 0);

        ArcSettlement.Bounty memory b = s.getBounty(id);
        assertEq(uint256(b.status), uint256(ArcSettlement.Status.Rejected));
    }

    function testGenuineButBelowThresholdIsRejected() public {
        uint256 id = _post();
        _claimSubmit(id);

        // genuine authorship but spec match below the 50 floor -> withheld
        vm.prank(relayer);
        s.settle(id, ArcSettlement.Verdict.Genuine, 96, 20, "off-spec");

        assertEq(s.creditOf(worker), 0);
        assertEq(s.creditOf(client), 6 ether);
    }

    function testOnlyOracleCanSettle() public {
        uint256 id = _post();
        _claimSubmit(id);
        vm.prank(worker);
        vm.expectRevert(ArcSettlement.NotOracle.selector);
        s.settle(id, ArcSettlement.Verdict.Genuine, 99, 99, "self-serve");
    }

    function testClientCannotClaimOwnBounty() public {
        uint256 id = _post();
        vm.prank(client);
        vm.expectRevert(ArcSettlement.BadState.selector);
        s.claim{value: 1 ether}(id);
    }

    function testWrongStakeReverts() public {
        uint256 id = _post();
        vm.prank(worker);
        vm.expectRevert(ArcSettlement.BadAmount.selector);
        s.claim{value: 0.5 ether}(id);
    }

    function testCannotSettleTwice() public {
        uint256 id = _post();
        _claimSubmit(id);
        vm.prank(relayer);
        s.settle(id, ArcSettlement.Verdict.Genuine, 95, 90, "ok");
        vm.prank(relayer);
        vm.expectRevert(ArcSettlement.BadState.selector);
        s.settle(id, ArcSettlement.Verdict.Genuine, 95, 90, "again");
    }
}
