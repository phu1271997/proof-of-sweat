# Deploying Proof of Sweat to GenLayer studionet

Everything targets **studionet** (GenLayer Studio hosted). Do not use a testnet faucet.

## 1. Deploy the contract in Studio

1. Open <https://studio.genlayer.com/run-debug>.
2. **Settings → Reset Storage → Confirm**, then hard-refresh (Cmd+Shift+R).
3. Deploy **`contracts/storage_test.py`** first. Click its transaction in the sidebar and
   confirm **`Result: SUCCESS`** (not just `Status: FINALIZED`). This proves the environment
   is healthy before you blame the main contract for anything.
4. Deploy **`contracts/proof_of_sweat.py`**. Again click the tx → verify `Result: SUCCESS`.
5. Copy the deployed **contract address**.

> If deploy fails:
> - `Contract Queues not found` → the version pragma on line 1 is missing/altered. Keep the
>   `# { "Depends": "py-genlayer:..." }` line exactly as shipped, on line 1.
> - `Could not load contract schema` → a storage type problem. This contract is already
>   schema-clean (str-keyed TreeMaps, `bigint`/`u8`, `@allow_storage @dataclass`).
> - `AttributeError: ... run_nondet` → change `gl.vm.run_nondet` to `gl.vm.run_nondet_unsafe`
>   in `adjudicate()` and redeploy.

## 2. Fund your demo wallet (studionet)

1. In Studio, open the **Accounts** panel.
2. Transfer GEN from a pre-funded Studio account to your **MetaMask** address on studionet.
3. You'll want enough to: post a bounty (reward), claim one (stake), and pay a little gas.
   A few GEN is plenty for a demo.

Do **not** use `testnet-faucet.genlayer.foundation` — that funds testnet, a different network.

## 3. Configure and run the frontend

```bash
cd frontend
cp .env.example .env
# edit .env → VITE_CONTRACT_ADDRESS=0x<your deployed address>
npm install
npm run dev        # http://localhost:5173
```

MetaMask will be prompted to add/switch to the "Genlayer Studio Network" (chain id 61999)
automatically on connect.

## 4. Seed demo data (do this before recording / submitting)

A reviewer opening a live app to an empty list has nothing to judge. Seed at least:

- **1 approved bounty** — post a bounty, claim it from a second account, submit a genuine
  deliverable URL (e.g. a real gist / article you wrote), run the jury → `GENUINE`.
- **1 rejected bounty** — submit an obviously AI-generated / off-spec URL, run the jury →
  `AI_GENERATED`, then either appeal (and let it uphold) or finalize as the client.

Reads don't need a wallet, so after seeding, open the live URL in an incognito window with no
wallet connected and confirm the seeded bounties + verdicts are visible.

## 5. Deploy the frontend (Vercel)

- Import the repo, set **Root Directory** to `frontend/`.
- Framework preset: Vite. Build: `npm run build`. Output: `dist`.
- Add env var **`VITE_CONTRACT_ADDRESS`** = your contract address.
- Deploy → copy the public URL into the README + your Explorer submission.

## 6. Verify on-chain

```bash
curl -s -X POST https://studio.genlayer.com/api \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractSchema","params":["0x<contract>"]}'
```

A JSON schema listing the methods = the contract is live and readable.
