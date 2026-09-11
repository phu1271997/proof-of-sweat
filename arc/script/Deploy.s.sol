// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArcSettlement} from "../src/ArcSettlement.sol";

/// Deploy ArcSettlement to Arc testnet.
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io \
///     --private-key $GENLAYER_PRIVATE_KEY --broadcast
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        ArcSettlement s = new ArcSettlement();
        console.log("ArcSettlement deployed at:", address(s));
        console.log("owner/oracle:", s.owner());
        vm.stopBroadcast();
    }
}
