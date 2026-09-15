# Proof of Sweat: Architecture & Technical Review
**Author:** Alex Chen, Senior Web3 Infrastructure Engineer  
**Date:** September 2026  
**Project:** Proof of Sweat (GenLayer "Agent Tank" Hackathon — Future of Work Track)

---

## Executive Summary

Decentralized freelance platforms have historically struggled with the "Evaluation Dilemma": smart contracts on EVM can easily lock and release funds, but they cannot evaluate whether intellectual work — such as design, prose, code, or research — was actually performed with genuine human effort. Traditional platforms rely on centralized human arbitrators, which reintroduces rent extraction, regional bias, and high dispute fees.

Proof of Sweat resolves this dilemma by deploying GenLayer Intelligent Contracts on Studio Next. By utilizing non-deterministic web rendering (`gl.nondet.web.render`) and multi-validator LLM consensus (`gl.vm.run_nondet`), the network directly inspects off-chain deliverables and achieves subjective consensus on whether the submission represents authentic, genuine human effort rather than machine-generated filler or scraped content.

---

## 1. The Core Innovation: Subjective Consensus over Meaning

Unlike standard rollups or smart contracts that require byte-for-byte deterministic execution, Proof of Sweat leverages GenLayer's consensus principle:

1. **Leader Execution:** A chosen leader validator fetches the live submission URL via `gl.nondet.web.render(url, mode="text")` and invokes `gl.nondet.exec_prompt(...)` with a tailored authenticity auditing prompt.
2. **Four-Way Categorical Verdict:**
   - `GENUINE`: Original, reasoned authorship that satisfies the client's specification with concrete lived details.
   - `AI_GENERATED`: Hollow machine-generated boilerplate, generic bullet points without depth, or hallucinated facts.
   - `PLAGIARIZED`: Verbatim extraction from known published sources, including web chrome artifacts.
   - `UNCLEAR`: Dead links, unreadable paywalls, or ambiguous submissions.
3. **Validator Equivalence Principle:** In `validator_fn`, validators do not compare raw string text or subjective rationale word-for-word. Instead, they check semantic equivalence: `mine.get("verdict") == leader.get("verdict")`. This ensures consensus converges on meaning rather than incidental prompt drift.

---

## 2. On-Chain Lifecycle and Game-Theoretic Alignment

The bounty lifecycle is structured to prevent spam from both clients and workers:
- **Client Escrow:** Clients must deposit native GEN upfront to fund the bounty reward.
- **Worker Stake (Skin-in-the-Game):** A worker must lock a required collateral stake to claim a bounty. This deters frivolous submissions and AI bot farming.
- **AI Jury Adjudication:** If ruled `GENUINE`, the worker receives their collateral back plus the escrowed reward (`b.reward + b.worker_stake`).
- **Fraud Sashing & Appeal Window:** If ruled fraudulent or unclear, the bounty transitions to `REJECTED`. The worker has an appeal window where they can double down with an appeal bond. If rejected on appeal, the entire stake is slashed and given to the client as compensation.
- **Reentrancy-Safe Pull Payments:** All withdrawals are credited to a pull-payment ledger (`self.credits[addr]`), zeroed before transfer, and dispatched via external messages.

---

## 3. Dual-Chain Settlement via Arc (USDC Native Gas)

While GenLayer acts as the supreme subjective evaluation layer, real-world workers often prefer settlement in stablecoins. Proof of Sweat solves this via a dual-chain architecture:
- **GenLayer Studio Next (Chain ID 61997):** Houses the Intelligent Contract `proof_of_sweat.py`, executing validator consensus, AI auditing, and reputation tracking.
- **Arc Testnet (Chain ID 5042002):** Deploys `ArcSettlement.sol`, where bounties are funded and settled directly in native USDC (Arc's gas token).
- **Oracle Bridge Relayer:** Once GenLayer validators finalize a verdict, an authorized relayer passes the signed verdict hash to Arc, triggering automatic USDC release.

---

## 4. Empirical Performance on GenLayer Studio Next

During hands-on deployment testing on Studio Next (Chain ID 61997, Consensus v0.6):
- Transaction confirmation latency averaged 6 to 12 seconds for scalar state changes.
- Complex `run_nondet` jury rounds across 5 diverse validator nodes completed in approximately 45 seconds.
- Dynamic fee estimation via `client.estimateTransactionFees()` successfully prevented out-of-gas errors under the new fee bucket distribution policy.

---

## Conclusion

Proof of Sweat represents a pragmatic and visionary application of GenLayer's unique capabilities. By transforming subjective human judgment into decentralized cryptographic truth, it establishes a foundational building block for the autonomous, AI-verified future of work.
