# Proof of Sweat on Arc — the USDC settlement layer

Proof of Sweat is **multichain by design**. The two chains do different jobs:

| Chain | Role | What lives here |
|---|---|---|
| **GenLayer** studionet | **Judgment** | The Intelligent Contract runs the AI jury: it reads the deliverable on-chain and reaches validator consensus on a verdict (GENUINE / AI_GENERATED / PLAGIARIZED / UNCLEAR) with a confidence and spec-match score. |
| **Arc** testnet | **Money** | `ArcSettlement.sol` escrows the bounty reward and worker stake in **native USDC** and releases it in USDC based on the relayed verdict. |

Why split it this way: judging authenticity is a subjective, web-reading task that only
GenLayer can do. Settling in a stable, predictable currency at sub-second finality is exactly
what Arc is built for (USDC is the gas token). Neither chain can do the other's job well, so
Proof of Sweat uses each for its strength.

## Flow

```
client posts bounty (USDC escrow on Arc)  ──►  worker claims + stakes (USDC on Arc)
                                                        │
                                                        ▼
                                          worker submits deliverable URL (Arc)
                                                        │
                        GenLayer AI jury reads the URL, reaches consensus  ◄── same URL
                                                        │  verdict + confidence + spec-match + reason
                                                        ▼
                     relayer calls ArcSettlement.settle(...) with the verdict
                                                        │
                        genuine ► worker withdraws reward + stake in USDC
                        fraud   ► client refunded reward + slashed stake in USDC
```

The GenLayer verdict is carried to Arc by an authorized `oracle` (the settlement relayer).
This contract never judges; it only settles, mirroring the GenLayer escrow rules so both
chains agree on the outcome.

## Contract: `src/ArcSettlement.sol`

Native-USDC escrow (USDC is Arc's 18-decimal gas token, held as `msg.value`):
- `postBounty(title, spec, stake)` payable — escrow the reward.
- `claim(id)` payable — lock exactly the required stake.
- `submit(id, url)` — attach the deliverable the jury will read.
- `settle(id, verdict, confidence, specMatch, reason)` — **oracle-only**; releases escrow.
- `withdraw()` — pull-payment, reentrancy-safe.
- Views: `bountyCount`, `getBounty`, `creditOf`.

Thresholds mirror the GenLayer contract: pay only when the verdict is `Genuine` with
`confidence >= 60` and `specMatch >= 50`.

## Arc testnet

| | |
|---|---|
| Network | Arc Testnet |
| Chain ID | `5042002` (`0x4cef52`) |
| RPC | `https://rpc.testnet.arc.io` |
| Gas token | native USDC (18 decimals) |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |

## Test

```bash
cd arc
forge test
```

7 passing tests cover the genuine payout, the fraud refund + slash, the below-threshold
withhold, oracle-only settlement, and the claim guards.

## Deploy

The deployer needs a little native USDC on Arc testnet for gas (get it from the Circle
faucet to the deployer address, then):

```bash
cd arc
source ~/.genlayer/env.sh
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key "$GENLAYER_PRIVATE_KEY" \
  --broadcast
```

After deploy, set the settlement relayer if it differs from the deployer with
`setOracle(address)`, and record the deployed address in the frontend config.
