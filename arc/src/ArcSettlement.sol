// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ArcSettlement — the USDC settlement leg for Proof of Sweat.
/// @notice Proof of Sweat is multichain by design:
///   - GenLayer is the *judgment* layer. Its Intelligent Contract runs the AI
///     jury (reads the deliverable on-chain, reaches consensus on a verdict).
///   - Arc is the *money* layer. Native USDC is the gas token here, so bounty
///     rewards and worker stakes are escrowed as msg.value and released in USDC.
///
/// A verdict produced by the GenLayer jury is relayed to this contract by an
/// authorized `oracle` (the settlement relayer). This contract does not judge;
/// it settles. The escrow logic mirrors the GenLayer contract so the two chains
/// agree on outcomes: genuine work is paid, fraud is refunded and the stake slashed.
contract ArcSettlement {
    enum Status {
        Open, // 0 funded, awaiting a worker
        Claimed, // 1 worker staked and is working
        Submitted, // 2 deliverable submitted, awaiting the relayed verdict
        Approved, // 3 genuine, worker credited reward + stake
        Rejected // 4 fraud/off-spec, client refunded reward + slashed stake
    }

    // Mirrors the GenLayer jury's verdict vocabulary.
    enum Verdict { None, Genuine, AiGenerated, Plagiarized, Unclear }

    struct Bounty {
        address client;
        address worker;
        uint128 reward; // native USDC (18 decimals) escrowed at post time
        uint128 stake; // native USDC the worker must lock to claim
        Status status;
        Verdict verdict;
        uint8 confidence; // 0-100, from the jury
        uint8 specMatch; // 0-100, from the jury
        string title;
        string spec;
        string deliverableUrl;
        string reason; // the jury's written rationale, relayed for transparency
    }

    address public owner;
    address public oracle; // relays the GenLayer verdict; starts as the deployer
    uint8 public minConfidence = 60;
    uint8 public minSpecMatch = 50;

    Bounty[] private bounties;
    mapping(address => uint256) public credits; // pull-payment ledger

    event BountyPosted(uint256 indexed id, address indexed client, uint256 reward, uint256 stake);
    event BountyClaimed(uint256 indexed id, address indexed worker, uint256 stake);
    event WorkSubmitted(uint256 indexed id, string deliverableUrl);
    event Settled(uint256 indexed id, Verdict verdict, uint8 confidence, uint8 specMatch, bool paid);
    event Withdrawn(address indexed to, uint256 amount);
    event OracleChanged(address indexed oracle);

    error NotOwner();
    error NotOracle();
    error BadState();
    error BadAmount();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor() {
        owner = msg.sender;
        oracle = msg.sender;
    }

    function setOracle(address o) external onlyOwner {
        oracle = o;
        emit OracleChanged(o);
    }

    function setThresholds(uint8 c, uint8 s) external onlyOwner {
        minConfidence = c;
        minSpecMatch = s;
    }

    /// @notice Post a bounty. The reward (msg.value, native USDC) is escrowed now.
    function postBounty(string calldata title, string calldata spec, uint128 stake)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert BadAmount();
        id = bounties.length;
        Bounty storage b = bounties.push();
        b.client = msg.sender;
        b.reward = uint128(msg.value);
        b.stake = stake;
        b.title = title;
        b.spec = spec;
        b.status = Status.Open;
        emit BountyPosted(id, msg.sender, msg.value, stake);
    }

    /// @notice Claim an open bounty by locking exactly the required stake in USDC.
    function claim(uint256 id) external payable {
        Bounty storage b = bounties[id];
        if (b.status != Status.Open) revert BadState();
        if (msg.sender == b.client) revert BadState(); // a client cannot claim their own bounty
        if (msg.value != b.stake) revert BadAmount();
        b.worker = msg.sender;
        b.status = Status.Claimed;
        emit BountyClaimed(id, msg.sender, msg.value);
    }

    /// @notice Submit the deliverable as a public URL for the jury to read.
    function submit(uint256 id, string calldata deliverableUrl) external {
        Bounty storage b = bounties[id];
        if (b.status != Status.Claimed || msg.sender != b.worker) revert BadState();
        b.deliverableUrl = deliverableUrl;
        b.status = Status.Submitted;
        emit WorkSubmitted(id, deliverableUrl);
    }

    /// @notice Relay the GenLayer jury verdict and settle the USDC escrow.
    /// @dev Only the authorized oracle (settlement relayer) may call this.
    function settle(uint256 id, Verdict verdict, uint8 confidence, uint8 specMatch, string calldata reason)
        external
        onlyOracle
    {
        Bounty storage b = bounties[id];
        if (b.status != Status.Submitted) revert BadState();
        b.verdict = verdict;
        b.confidence = confidence;
        b.specMatch = specMatch;
        b.reason = reason;

        bool paid = verdict == Verdict.Genuine && confidence >= minConfidence && specMatch >= minSpecMatch;
        if (paid) {
            // Worker gets the reward plus their own stake back.
            credits[b.worker] += uint256(b.reward) + uint256(b.stake);
            b.status = Status.Approved;
        } else {
            // Client is refunded the reward and keeps the slashed stake.
            credits[b.client] += uint256(b.reward) + uint256(b.stake);
            b.status = Status.Rejected;
        }
        emit Settled(id, verdict, confidence, specMatch, paid);
    }

    /// @notice Pull-payment withdrawal (reentrancy-safe: zero before transfer).
    function withdraw() external {
        uint256 amt = credits[msg.sender];
        if (amt == 0) revert BadAmount();
        credits[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok, "USDC transfer failed");
        emit Withdrawn(msg.sender, amt);
    }

    // ── views ────────────────────────────────────────────────────────────────
    function bountyCount() external view returns (uint256) {
        return bounties.length;
    }

    function getBounty(uint256 id) external view returns (Bounty memory) {
        return bounties[id];
    }

    function creditOf(address a) external view returns (uint256) {
        return credits[a];
    }
}
