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

## The AI Courtroom — adversarial deliberation (v0.5.0)

A single judge, even a three-lens one, anchors on its first impression. v0.5 turns one
reasoning pass into an **adversarial trial that runs entirely on-chain** inside the
non-deterministic block:

- **Stage A — adversarial briefs.** One structured pass writes *both* sides of the case
  from the same evidence: a **Prosecution** brief arguing the work is fraud (AI-generated,
  plagiarized, or off-spec) and a **Defense** brief arguing it is genuine — each forced to
  cite concrete evidence from the deliverable and the live web cross-check.
- **Stage B — the ruling.** A second pass acts as the **presiding judge**: it weighs both
  briefs against the evidence and returns the final verdict, the three lens scores, and the
  pay decision. Seeing the strongest case for *both* outcomes before ruling is what pushes
  borderline calls off the fence instead of rubber-stamping a first read.
- **Worker agency on appeal.** A rejected worker can attach a written **rebuttal** when they
  appeal. It is admitted into evidence on-chain, the Defense brief must engage with it, and
  the judge must weigh it. The appeal is no longer a silent dice re-roll — the worker argues
  their side into the permanent record.
- **Full transparency.** Both briefs and the rebuttal are stored on-chain and shown in the
  UI, so anyone can read exactly *how* a verdict was argued, not just what it was.

Across one adjudication the contract now performs **four non-deterministic operations on
chain**: it reads the deliverable, runs a live quoted web search (the plagiarism
cross-check), argues the adversarial briefs, and rules. Consensus is **unchanged** and still
checks *meaning* — validators agree on the verdict and every pay gate, never on the free-text
briefs. This is advanced on-chain AI reasoning no ordinary smart contract can approach.

## The Skeptics' Market — staked, AI-settled second opinions (v0.6.0)

A jury verdict used to end the story. The Skeptics' Market turns **every settled
verdict into a permissionless, staked truth market whose settler is a fresh run of
the same on-chain AI courtroom** — so the jury is never the final word, and being
wrong costs money.

- **Anyone can challenge a resolved verdict.** `open_challenge` / `back_challenge`
  (both payable) let anyone stake native GEN on **GENUINE** (the work is real) or
  **FAKE** (the work is fraud). Both sides accumulate a pot during a stake window.
- **A fresh AI re-trial settles it, trustlessly.** When the window closes,
  `resolve_challenge` runs the **same adversarial courtroom again** inside
  `gl.vm.run_nondet` — it re-reads the deliverable, re-runs the live web cross-check,
  re-argues both briefs and re-rules. The side the fresh ruling agrees with **wins and
  splits the whole pot pro-rata**; an `UNCLEAR` re-trial **VOIDs and refunds** everyone.
  There is no admin, no oracle, no multisig — the settlement *is* an on-chain AI judgment.
- **An overturn rewrites the record.** If the market's fresh ruling flips the bounty's
  original stance, the worker's **portable on-chain reputation is corrected** — a staked
  crowd plus a fresh AI panel can overturn a permanent record, not merely win a side bet.
  This is the economic pressure that keeps the jury honest.
- **Consensus still checks meaning.** The settling `validator_fn` agrees on the re-trial
  verdict **and** every pay gate, so the winning side is identical across the network or
  there is no settlement — the same meaning-not-shape guarantee the jury itself uses.

> **Why this is pure GenLayer.** The market's settler is a *subjective judgment over live
> web content*. A Solidity prediction market needs a human/oracle to report the outcome;
> here the outcome is decided on-chain by validators each running a different LLM. Remove
> the AI and the market has nothing to settle it.

## AI Jury 2.0 — multi-perspective panel + live web cross-check (v0.4.0)

The adjudication was rebuilt from a single prompt into a **three-lens panel backed by a
second, independent on-chain web read**:

- **Three auditor lenses in one structured pass** — *Forensic Authorship*,
  *Originality/Plagiarism*, and *Spec Compliance*. Each returns its own 0-100 score and a
  one-line finding, all stored on-chain and shown in the UI, so you see *why* a verdict
  landed instead of one averaged number.
- **Live web cross-check** — before judging, the contract extracts a distinctive phrase
  from the deliverable and runs a **live quoted web search** with a second
  `gl.nondet.web.render`. A verbatim match elsewhere is concrete evidence of copying; it
  **floors originality and blocks payment** no matter how confident the model sounded.
- **Four payment gates, not one** — payment requires `GENUINE` **and** confidence ≥ 60
  **and** spec-match ≥ 50 **and** authenticity ≥ 55 **and** originality ≥ 55. Polished-but-
  machine-written work the model still labels "GENUINE" no longer slips through.
- **Consensus over every gate** — validators agree on the verdict **and** each gate's
  pass/fail. Different wording still agrees; any real disagreement on meaning or on the
  pay decision blocks consensus.

## Escrow safety — protected appeal window (v0.4.1)

A rejection no longer lets the client close the grant out from under the worker. When the
jury rejects a deliverable the contract stamps `rejected_at` and starts a **protected appeal
window** (`appeal_window_secs`). During that window `finalize_rejection` reverts — the worker
is guaranteed time to **appeal or resubmit**. Only after the window elapses, if the worker did
nothing, can the client finalize and recover the escrow. This fixes a reported flaw where a
client could finalize a rejection instantly and strip the worker of their advertised appeal
rights. The window end is exposed on-chain (`finalizable_at`) and the UI shows it instead of a
live "Finalize" button while the window is open. Timestamps use a consensus-safe block clock.

## Architecture

- **`contracts/proof_of_sweat.py`** — the Intelligent Contract (Python).
  - Non-deterministic judgment runs inside `gl.vm.run_nondet(leader_fn, validator_fn)`.
  - `leader_fn` reads the deliverable with `gl.nondet.web.render(url, mode="text")`, runs a live
    web cross-check (a second `web.render`), then argues the case with **two** `gl.nondet.exec_prompt`
    passes — the adversarial briefs and the judge's ruling.
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
contracts/       proof_of_sweat.py  ·  proof_of_sweat_studio_next.py  ·  storage_test.py
frontend/        React + genlayer-js dApp
tests/           direct-mode gltest suite (48 cases, all passing)
docs/samples/    example deliverables used by the jury demo
scripts/deploy/  DEPLOY.md — studionet deploy walkthrough  ·  seed_phase1_jury2.js
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
- `test_validators_disagree_when_authenticity_gate_differs` — same verdict but a different
  pay decision on the new authenticity gate ⇒ **no consensus**.
- `test_web_crosscheck_hit_blocks_payment` — a verbatim web match floors originality and
  blocks payment even when the model reported high originality.
- `test_low_authenticity_genuine_does_not_pay` — polished work the forensic lens flags as
  machine-written is not paid.
- `test_client_cannot_finalize_during_appeal_window` — the escrow-flaw fix: a client cannot
  finalize a rejection while the worker's appeal window is still open (and the worker can still
  appeal); `test_finalize_rejection_pays_client` confirms the client can finalize once it elapses.
- `test_courtroom_briefs_recorded` — both adversarial briefs (Prosecution + Defense) from the
  two-pass on-chain trial are stored and returned to the UI.
- `test_appeal_rebuttal_admitted_into_evidence` — a worker's written rebuttal is recorded
  on-chain on appeal and the stricter re-trial can overturn the ruling.
- `test_courtroom_degrades_without_briefs` — adjudication still produces a verdict if the
  briefs pass yields nothing (backward-compatible degrade).
- **Skeptics' Market (`tests/test_challenge_market.py`)** — `test_resolve_upholds_genuine_and_splits_pot`
  (a 600 pot splits 150/450 pro-rata across the winning side), `test_resolve_overturns_to_fake_and_marks_worker`
  and `test_resolve_overturns_fraud_to_genuine` (a fresh re-trial flips the verdict and rewrites the worker's
  reputation), `test_unclear_retrial_voids_and_refunds` (VOID refunds every staker), and
  `test_challenge_consensus_disagrees_on_different_verdict` (the settling re-trial needs real consensus too).

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
| **Network** | GenLayer **Studio Next** (Chain ID `61997`, Consensus v0.6) |
| **Contract address** | `0x1fC085D937fbDCee73f9c4C5A1bcB767346716Fe` (v0.6.0 — Skeptics' Market, staked AI-settled second opinions) |
| **Explorer** | https://explorer-studio-dev.genlayer.com/address/0x1fC085D937fbDCee73f9c4C5A1bcB767346716Fe |
| **Live app (v0.6.0)** | https://proof-of-sweat-eosin.vercel.app |
| **Live app (canonical)** | https://proofofsweat-app-omega.vercel.app |
| **Repo** | https://github.com/phu1271997/proof-of-sweat |
| **Demo video** | `TO BE FILLED` |

> Previous versions: `0x38e53C1BF5128f05D6EAd05b56bdfF4c8305cd68` (v0.3, single-prompt jury),
> `0xC1d76d6FF8DFFE2429e4Fb4f4A8174647524F27D` (v0.4.0, AI Jury 2.0),
> `0x9276b3d543297bE6fAa72c869a7C34431850ad68` (v0.4.1, + protected appeal window),
> `0x8EFD51C83e606B1adCd95E14b73DD17967Ef20F0` (v0.5.0, AI Courtroom). v0.6.0 is a fresh deploy
> because the storage schema gained the `Challenge` struct and the Skeptics' Market methods.

**Multichain: Arc settlement layer.** GenLayer judges; Arc settles in USDC. The `ArcSettlement`
contract is deployed on Arc testnet and the app has a chain switcher (GenLayer / Arc).

| | |
|---|---|
| **Network** | Arc Testnet (chain `5042002`), gas in native USDC |
| **Contract address** | `0xd898EF839DE88dE38113f0560F8fEBEff73D09c8` |
| **Explorer** | https://testnet.arcscan.app/address/0xd898EF839DE88dE38113f0560F8fEBEff73D09c8 |
| **Source + tests** | [`arc/`](arc/) (Foundry, 7 passing tests) |

Verified end-to-end on Studio Next with the v0.5.0 contract (all by real validator consensus —
see the Explorer tab in the app): a **GENUINE** first-person deliverable where the on-chain
**Defense** brief prevailed (authenticity 91 / originality 93, clean web cross-check) and the
worker was **paid**; a **PLAGIARIZED** copy of a public Wikipedia article where the
**Prosecution** brief cited the copied text, originality collapsed to 2, and it was
**rejected** into the protected appeal window; and an **appeal with a written rebuttal** on
that case — the worker's plea was admitted into the on-chain record, the courtroom re-argued
both sides, and fraud was **upheld** because a verbatim source match is concrete evidence a
rebuttal can't argue away.

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
