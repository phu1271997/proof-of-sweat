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

### Docs
- README (problem, architecture, consensus explanation, rubric mapping), `scripts/deploy/DEPLOY.md`.
