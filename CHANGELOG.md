# Changelog

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

### Docs
- README (problem, architecture, consensus explanation, rubric mapping), `scripts/deploy/DEPLOY.md`.
