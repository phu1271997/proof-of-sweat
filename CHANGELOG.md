# Changelog

## [1.4.0] — The Skeptics' Market: staked, AI-settled second opinions (Milestone — Phase 3)

A jury verdict used to be the end of the story — once the AI jury ruled, the case
was closed and nobody could put money behind "the jury got this wrong." v0.6 turns
every settled verdict into a **permissionless, staked truth market** whose settler
is a fresh run of the same on-chain AI courtroom. This is a major-feature milestone:
new economic game theory, four new contract methods, a reused-but-independent nondet
settlement path, and a reputation-correction mechanism with real teeth.

### Contract (`contracts/proof_of_sweat_studio_next.py`, `contracts/proof_of_sweat.py`) → v0.6.0
- **Staked challenge market.** Anyone can open a second opinion on a *resolved*
  bounty and stake native GEN on **GENUINE** (the work is real) or **FAKE** (the
  work is fraud); others back either side until a stake window closes.
  `open_challenge(bounty_id, side)` / `back_challenge(bounty_id, side)` (both payable).
- **Trustless AI settlement.** After the window, `resolve_challenge(bounty_id)` runs
  the **same adversarial AI courtroom again** inside `gl.vm.run_nondet` as the
  settler — four more on-chain nondet ops (read deliverable, live web cross-check,
  adversarial briefs, ruling). The side the fresh ruling agrees with **wins and
  splits the whole pot pro-rata**; an `UNCLEAR` re-trial **VOIDs and refunds** everyone.
- **Reputation correction (the teeth).** If the market's fresh ruling **flips** the
  bounty's original stance, the worker's portable on-chain reputation is rewritten
  (`overturned` on the challenge) — a staked crowd plus a fresh AI panel can correct
  the permanent record, not merely win a side bet.
- **Shared courtroom.** The adversarial-trial logic was extracted into a single
  module-level `_courtroom(...)` used by both `adjudicate()` and `resolve_challenge()`,
  so the jury and the market settler run byte-for-byte the same reasoning.
- **Consensus unchanged and still over meaning.** The settling `validator_fn`
  compares the re-trial verdict **and** every pay gate — the winning side is identical
  across the network or there is no settlement. Two validators that reach different
  settling verdicts do **not** reach consensus.
- **Flat storage.** The per-staker ledger lives in a JSON `stakes_json` string (never
  a nested `DynArray`/`TreeMap`), so the schema generator stays happy. New views:
  `get_challenge`, `get_challenge_by_id`, `get_all_challenges`; `get_config` exposes
  `challenge_window_secs` / `total_challenges`.

### Tests (`tests/`)
- 34 → **48 passing**. New `tests/test_challenge_market.py`: zero-state views, every
  payable/state/window guard, a full open→back→settle flow with a **pro-rata pot split**
  (100:300 GENUINE stakes split a 600 pot into 150/450), an **overturn** that marks the
  worker's reputation (both GENUINE→FRAUD and FRAUD→GENUINE), a **VOID refund** on an
  UNCLEAR re-trial, and the **consensus guarantee** on the settling re-trial.

### Frontend (`frontend/`)
- New **Skeptics' Market** panel on every resolved bounty: a GENUINE/FAKE side picker,
  a live pot bar with both sides and a stake-window countdown, a one-click **Settle with
  a fresh AI re-trial** action once the window closes, and the settled result — the
  re-trial verdict, the winning side, an **"OVERTURNED the jury"** badge, both re-trial
  briefs, and a withdraw button for winnings. The Explorer gained **market challenges**
  and **verdicts overturned** tiles.

### Redeployed to GenLayer Studio Next
- New contract (schema gained the `Challenge` struct + market methods):
  `0x1fC085D937fbDCee73f9c4C5A1bcB767346716Fe`. Seeded end-to-end by real validator
  consensus: a GENUINE bounty paid by the jury, a Skeptics' Market opened on it (FAKE vs
  GENUINE stakes), and the market settled by a fresh on-chain AI re-trial with the winning
  side paid out.

## [1.3.0] — The AI Courtroom: adversarial deliberation (Milestone — Phase 2)

The heart of the product — the adjudication — was rebuilt again, this time from a single
(if multi-lens) judgment pass into an **adversarial trial argued on-chain**. This is a
major AI-enhancement milestone: the contract now reasons over *both sides* of every case
before ruling, and the worker gets a real voice on appeal.

### Contract (`contracts/proof_of_sweat_studio_next.py`, `contracts/proof_of_sweat.py`) → v0.5.0
- **Two-stage nondet reasoning.** `adjudicate()` now runs two `gl.nondet.exec_prompt` passes
  inside the consensus block: **Stage A** writes a **Prosecution** brief (strongest honest case
  for fraud) and a **Defense** brief (strongest honest case for genuine) from the same evidence;
  **Stage B** is the **presiding judge**, which weighs both briefs against the evidence and
  returns the verdict + three lens scores + pay decision. Four nondet ops per verdict now:
  read deliverable, live web cross-check, adversarial briefs, ruling.
- **Worker rebuttal on appeal.** `appeal(bounty_id, rebuttal)` admits an optional written plea
  into evidence on-chain; the Defense brief must engage with it and the judge must weigh it. The
  appeal is a real argued case, not a silent re-roll. Stored as `rebuttal`.
- **Transparency.** The `prosecution` and `defense` briefs are stored on-chain and returned by
  `get_bounty` / `get_all_bounties`, so anyone can read *how* a verdict was argued.
- **Consensus unchanged and still over meaning.** `validator_fn` still compares the verdict and
  every pay gate (not the free-text briefs or reason), so honest validators with different
  wording agree while any real disagreement on the pay/no-pay decision blocks consensus.

### Tests (`tests/`)
- 31 → **34 passing**. New: both briefs recorded on-chain, a worker rebuttal is admitted on
  appeal and can overturn, and adjudication degrades gracefully if the briefs pass yields nothing.

### Frontend (`frontend/`)
- New **AI Courtroom** panel in the bounty detail: the Prosecution and Defense briefs shown
  side by side, and the worker's rebuttal (when filed on appeal). The appeal action gained a
  rebuttal textarea so the worker argues their case into the on-chain record.

### Redeployed to GenLayer Studio Next
- New contract (schema gained `prosecution` / `defense` / `rebuttal`):
  `0x8EFD51C83e606B1adCd95E14b73DD17967Ef20F0`. Reseeded end-to-end by real validator consensus:
  a GENUINE case where the Defense brief prevailed (paid), a PLAGIARIZED Wikipedia copy where
  the Prosecution brief cited the copied text (rejected), and an appeal with a written rebuttal
  on that case where fraud was upheld because a verbatim source match is concrete evidence.

## [1.2.1] — Escrow fix: enforced appeal window (judge feedback)

Fixes a reported escrow flaw: *"the sponsor can close a grant after an initial partial
settlement, preventing the builder from exercising their advertised appeal rights."*
Previously `finalize_rejection` had no delay, so a client could finalize a rejection in the
same breath as the verdict and slash the worker before any appeal.

### Contract (`contracts/proof_of_sweat_studio_next.py`, `contracts/proof_of_sweat.py`) → v0.4.1
- **Protected appeal window.** A rejecting verdict now stamps `rejected_at` and opens a window
  (`appeal_window_secs`, default 300s). `finalize_rejection` reverts until the window elapses,
  so the worker is guaranteed time to **appeal or resubmit**. After it elapses with no action,
  the client can finalize and recover escrow as before.
- Consensus-safe block clock via `datetime.now(UTC)` (GenVM feeds all validators the same time;
  verified on-chain — the rejecting adjudication reaches consensus and stores `rejected_at`).
- `get_bounty` now returns `rejected_at` + `finalizable_at`; `get_config` returns `appeal_window_secs`.

### Tests (`tests/`)
- 28 → **31 passing**. New: client cannot finalize during the window (worker can still appeal),
  worker can still resubmit during the window, `finalizable_at` is exposed; the existing finalize
  test now warps past the window first.

### Frontend (`frontend/`)
- While the appeal window is open, the client sees "Appeal window open until <time>" instead of a
  live **Finalize** button, so the UI matches the on-chain guarantee.

### Redeployed to GenLayer Studio Next
- New contract (schema gained `rejected_at` / `appeal_window_secs`):
  `0x9276b3d543297bE6fAa72c869a7C34431850ad68`. Reseeded end-to-end (GENUINE paid, PLAGIARIZED
  rejected and now sitting in its protected appeal window).

## [1.2.0] — AI Jury 2.0: multi-perspective panel + live web cross-check (Milestone — Phase 1)

The heart of the product — the adjudication — was rebuilt. This is a major-feature /
AI-enhancement milestone, not a tweak: the single-prompt judge became a three-lens
panel backed by a second, independent on-chain web read.

### Contract (`contracts/proof_of_sweat_studio_next.py`, `contracts/proof_of_sweat.py`) → v0.4.0
- **Multi-perspective jury.** One structured reasoning pass now runs THREE named
  auditor lenses — **Forensic Authorship**, **Originality/Plagiarism**, and
  **Spec Compliance** — and records each lens's score + one-line finding on-chain
  (`panel`), instead of a single averaged number.
- **Live web cross-check (a second nondet web read).** Before judging, `adjudicate()`
  extracts a distinctive phrase from the deliverable and runs a live quoted web search
  (`gl.nondet.web.render`). A verbatim match elsewhere is concrete plagiarism evidence;
  it **floors originality and blocks payment** regardless of model confidence. Outcome
  stored as `cross_check` (unknown / clean / hit). Degrades gracefully if the search is blocked.
- **Four-gate payment.** Payment now requires GENUINE **and** confidence ≥60 **and**
  spec-match ≥50 **and** authenticity ≥55 **and** originality ≥55. A polished-but-
  machine-written deliverable the model still calls "GENUINE" no longer gets paid.
- **Hardened consensus.** `validator_fn` now agrees on the verdict **and every pay
  gate's directional pass/fail** (verdict, confidence, spec, authenticity, originality).
  Honest validators with different wording still agree; any real disagreement on meaning
  or on the pay/no-pay decision blocks consensus.
- `get_config` exposes the new `min_authenticity` / `min_originality` gates; `get_bounty`
  / `get_all_bounties` return `authenticity`, `originality`, `cross_check`, and `panel`.
- Stdlib-free URL encoding (no `urllib`) so the genvm sandbox deploys clean.

### Tests (`tests/`)
- Grew from 22 → **28 passing** direct-mode cases. New: panel recorded on-chain,
  live cross-check HIT blocks payment, authenticity gate blocks slick-but-fake work,
  consensus disagrees when the authenticity gate differs, and the new config gates.

### Frontend (`frontend/`)
- Verdict panel now shows **Authenticity** and **Originality** meters alongside
  Confidence and Spec match, a **live web cross-check** pill (clean / verbatim-match /
  no-corroboration), and the **three-lens panel breakdown** with per-lens findings.
- Explorer rows surface the extra meters and a cross-check tag.

### Redeployed to GenLayer Studio Next
- New contract (schema changed): address recorded in `README.md` deployment table and `SUBMISSION.md`.
- Reseeded end-to-end: a GENUINE first-person deliverable (paid, cross-check clean) and a
  copied Wikipedia article (PLAGIARIZED, rejected) — both decided by real validator consensus.

## [1.1.0] — GenLayer Studio Next Migration (Consensus v0.6 & Fee Model)

### Contract (`contracts/proof_of_sweat_studio_next.py`, `contracts/proof_of_sweat.py`)
- Upgraded runtime pragma to GenVM v0.3.0 (`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`).
- Modernized inheritance to `gl.contract.Contract` and typed storage structures to `gl.storage.TreeMap` and `gl.storage.DynArray`.
- Deployed on **GenLayer Studio Next** at `0xF50d94C96dbE81e3b15Eb8fd0e4De24F1690b3f6`.
- Verified on-chain state transition: created Genesis Bounty on Studio Next (Tx: `0xeab1c3f177a9e9cf50e13a27c450d6fb7cd8d81842122c63ab7dc50c968992cb`).

### Frontend & SDK
- Upgraded to `@genlayer/transaction-kit@0.1.0-rc.2`, `@genlayer/transaction-kit-react@0.1.0-rc.2`, and `genlayer-js@2.0.0-rc.1`.
- Migrated chain configuration to **GenLayer Studio Next** (Chain ID: `61997`, RPC: `https://studio-next.genlayer.com/api`).
- Configured dynamic fee policy estimation (`estimateTransactionFees`) and receipt polling (`waitUntil: 'decided'`).
- Production deployment updated on Vercel: `https://proofofsweat-app.vercel.app`.

## [1.0.0] — Agent Tank hackathon submission

### Contract (`contracts/proof_of_sweat.py`)
- Bounty escrow judged by GenLayer subjective consensus (Future of Work track).
- On-chain authenticity verdict: `web.render` reads the deliverable, `exec_prompt` judges it
  (GENUINE / AI_GENERATED / PLAGIARIZED / UNCLEAR) with confidence + spec-match + rationale.
- Custom `validator_fn` under `gl.vm.run_nondet` compares the **verdict**, not JSON shape.
- Self-written appeal flow with re-adjudication; confidence-threshold escalation.
- Pull-payment withdrawal ledger (reentrancy-safe) and portable on-chain reputation.

### Tests (`tests/`)
- 22 direct-mode `genlayer-test` cases, all passing — happy path, edge cases, appeal flow,
  and the consensus guarantee (different verdicts do not reach agreement).

### Frontend (`frontend/`)
- React + Vite + `genlayer-js` dApp; MetaMask signing, auto network switch to studionet.
- Full lifecycle UI (post → claim → submit → AI jury → verdict → withdraw/appeal), consensus
  loading states, prominent AI `reason` display, Explorer links, reputation badges.

### Verified on studionet
- Deployed at `0x727Ba3DBB6683c04c34B795fbdAF269e917b01A4`. Full lifecycle exercised on-chain:
  create → claim → submit → real `run_nondet` adjudication → verdict → withdraw.
- Fixed: `withdraw` now transfers native GEN to EOAs via the EVM contract interface (the
  previous `emit_transfer` on `get_contract_at` was a silent no-op on studionet).
- Fixed: the jury prompt now presumes genuineness and requires concrete evidence for a fraud
  verdict — validated across GENUINE / AI_GENERATED / PLAGIARIZED deliverables.

### Review feedback (frontend, no contract change)
- Split the single-page app into distinct routes: `/app` (bounty board), `/post` (dedicated
  posting page), and `/explorer`. Primary actions each get their own space instead of tabs.
- New **Explorer** page (`/explorer`): every resolved case read straight from the contract, with
  verdict, confidence, spec-match, the AI's reasoning, and payout history, plus filters and a
  summary (cases resolved, GEN paid to workers, genuine vs fraud) and a link to the studio explorer.
- In-app top nav (Bounties / Post / Explorer) with active state; Explorer also linked from the landing nav.
- End-to-end frontend pass: deep links, client routing, empty/loading/error states, and form
  validation ("Connect your wallet first") all verified in-browser with no console errors.

### Multichain: Arc settlement layer (`arc/`)
- Proof of Sweat is now two-chain: GenLayer judges, **Arc settles in USDC**. GenLayer stays the
  AI-jury judgment layer; Arc is the money layer where reward and stake are escrowed and released
  in native USDC (Arc's gas token).
- `arc/src/ArcSettlement.sol`: native-USDC bounty escrow (post → claim → submit → settle → withdraw).
  A relayed GenLayer verdict is posted by an authorized `oracle`; genuine work pays the worker in
  USDC, fraud refunds the client and slashes the stake. Same thresholds as the GenLayer contract.
- `arc/`: Foundry project with 7 passing tests (genuine payout, fraud refund + slash, below-threshold
  withhold, oracle-only settlement, claim guards) and a deploy script for Arc testnet
  (chain `5042002`, RPC `https://rpc.testnet.arc.io`, gas in USDC).
- **Deployed to Arc testnet** at `0xd898EF839DE88dE38113f0560F8fEBEff73D09c8` and seeded end-to-end:
  a genuine bounty paid the worker in USDC (withdrawn on-chain), a fraud case refunded the client,
  and an open bounty awaits a claim.
- Frontend **chain switcher** (GenLayer / Arc): one UI over both chains via a chain adapter. GenLayer
  reads through `genlayer-js`; Arc reads/writes `ArcSettlement` through `viem`. Currency labels, explorer
  links, and available actions follow the selected chain (Arc hides the jury button since settlement is
  relayed). MetaMask auto-switches networks per chain.

### Docs
- README (problem, architecture, consensus explanation, rubric mapping), `scripts/deploy/DEPLOY.md`,
  `arc/README.md` (multichain architecture + Arc deploy steps).
