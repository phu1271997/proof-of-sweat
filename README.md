# 💧 Proof of Sweat

**Get paid for real work. AI-slop gets nothing.**

A bounty escrow on [GenLayer](https://genlayer.com) where a worker is paid **only if a
decentralized jury of AI validators reaches consensus that the delivered work is genuine
human/allowed effort** — not AI-generated slop, not plagiarism, not off-spec filler.

> **Why this can only exist on GenLayer.** Deciding *“is this genuine work or AI-generated
> slop?”* is a subjective judgment over live web content. A normal smart contract can't read
> the deliverable, can't reason about it, and can't converge on a fuzzy verdict. GenLayer can:
> each validator runs a **different** LLM, reads the deliverable on-chain, and the network
> reaches **subjective consensus** on the verdict. Remove the AI + web-reading and the product
> is impossible — not merely worse.

Built for the **GenLayer "Agent Tank" hackathon — Future of Work** track.

---

## The problem

The agent economy runs on outsourced work — bounties, gigs, freelance tasks. But it's now
trivial to fake effort: paste a ChatGPT answer, plagiarize a repo, ship off-spec filler.
Escrow contracts today can only check *that something was submitted*, never *whether it's real*.
Payment-on-delivery pays the fraudster.

Proof of Sweat makes **authenticity itself the release condition.**

## How it works

```
CLIENT                         WORKER                        AI JURY (validators)
  │ create_bounty (escrow GEN)    │                             │
  │──────────────────────────────▶ claim_bounty (stake GEN)     │
  │                               │──────────────────────────── ▶ submit_work(url)
  │                               │                             │
  │                     anyone ── adjudicate() ──────────────── ▶ each validator:
  │                               │                               • web.render(url)  ← reads deliverable on-chain
  │                               │                               • exec_prompt(...) ← LLM judges authenticity
  │                               │                             consensus on VERDICT
  │        GENUINE ✅  → reward + stake credited to worker  ◀────┤
  │        FRAUD   ❌  → appeal window → client compensated  ◀────┤
```

The verdict is one of `GENUINE`, `AI_GENERATED`, `PLAGIARIZED`, `UNCLEAR`, each with a
confidence score, a spec-match score, and a written rationale — all produced on-chain.

## Architecture

- **`contracts/proof_of_sweat.py`** — the Intelligent Contract (Python).
  - Non-deterministic judgment runs inside `gl.vm.run_nondet(leader_fn, validator_fn)`.
  - `leader_fn` reads the deliverable with `gl.nondet.web.render(url, mode="text")` and judges it
    with `gl.nondet.exec_prompt(prompt, response_format="json")`.
  - **`validator_fn` compares the `verdict` (the meaning), not the JSON shape.** Two honest
    validators that phrase their reasoning differently still agree; two validators that reach
    **different verdicts do not** — this is the line between a real GenLayer contract and a fake one.
  - Extras that push contract quality: a **self-written appeal flow** (re-adjudication with a
    stricter pass), a **confidence threshold** that escalates low-confidence calls instead of
    paying blindly, a **pull-payment** withdrawal ledger (reentrancy-safe), and **portable
    on-chain reputation** (genuine/fraud counts + trust score + GEN earned per worker).
- **`frontend/`** — React + Vite dApp using `genlayer-js`. MetaMask signs; nothing is
  hardcoded; the full lifecycle (post → claim → submit → jury → verdict → withdraw/appeal) is
  driven against the live contract, with loading states for consensus and the AI's `reason`
  shown prominently.
- **`tests/`** — `genlayer-test` direct-mode suite (in-memory, no network).

```
contracts/       proof_of_sweat.py  ·  storage_test.py
frontend/        React + genlayer-js dApp
tests/           direct-mode gltest suite (22 cases, all passing)
scripts/deploy/  DEPLOY.md — studionet deploy walkthrough
```

## Run the tests

Direct mode runs the contract in-memory — no Docker, no network.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest tests/ -v
```

The suite covers the happy path, every `UserError` edge case (zero reward, wrong stake,
double-claim, bad URL, non-worker submit, dead link → UNCLEAR, appeal bond too small…), the
appeal flow, and — most importantly — the **consensus guarantee**:

- `test_validators_disagree_on_different_verdict` — different verdicts ⇒ **no consensus**.
- `test_validator_rejects_reason_only_difference` — same verdict, different wording ⇒ still agree.

## Deploy to studionet + run the dApp

Full walkthrough in [`scripts/deploy/DEPLOY.md`](scripts/deploy/DEPLOY.md). Short version:

1. Open **[GenLayer Studio](https://studio.genlayer.com/contracts)**.
2. Deploy `contracts/storage_test.py` first to confirm the environment, then
   `contracts/proof_of_sweat.py`. Click the deploy tx and verify **`Result: SUCCESS`**.
3. Copy the contract address.
4. Fund your MetaMask account with GEN from Studio → **Accounts** (studionet, not a testnet faucet).
5. Configure and run the frontend:
   ```bash
   cd frontend
   cp .env.example .env      # set VITE_CONTRACT_ADDRESS=<your address>
   npm install
   npm run dev               # http://localhost:5173
   ```
6. Deploy the frontend to Vercel (root directory `frontend/`, env var `VITE_CONTRACT_ADDRESS`).

## Deployment details

| | |
|---|---|
| **Network** | GenLayer **studionet** (Studio hosted) — Explorer status: **Preview** |
| **Contract address** | `TO BE FILLED after deploy` |
| **Explorer** | `https://genlayer-explorer.vercel.app/address/<contract>` |
| **Live app** | `TO BE FILLED (Vercel URL)` |
| **Demo video** | `TO BE FILLED` |

## One-line pitch

> Proof of Sweat pays for work only when a decentralized AI jury agrees it's genuine — the
> escrow release *is* a subjective judgment over live web content, which no ordinary smart
> contract can make. Without GenLayer, it doesn't exist.

## Notes & limitations

- **`run_nondet` vs `run_nondet_unsafe`.** The contract uses the recommended
  `gl.vm.run_nondet`. If your Studio build raises `AttributeError` on it, change the single call
  in `adjudicate()` to `gl.vm.run_nondet_unsafe` (identical shape) — a runtime limitation, not a
  design choice.
- **Native payout.** Withdrawals use `gl.get_contract_at(recipient).emit_transfer(value=...)`.
  If your build handles EOA transfers differently, this is the one call site to adjust.
- studionet and testnet are separate networks. Everything here targets studionet; if you ever
  switch, redeploy and update `VITE_CONTRACT_ADDRESS`.
