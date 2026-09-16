# GenLayer Project Explorer — submission content

Paste these into the Portal form. All copy is in English and within each field's character limit.

---

## 01 · Identity

**Logo**
Upload `frontend/public/logo-badge.png` (512x512 PNG, opaque dark badge, ~68 KB — best contrast on the Portal's light card).
Transparent alternative: `frontend/public/logo.png`.

**Project name**
```
Proof of Sweat
```

**Primary category**
```
Dispute Resolution
```
Why: the core mechanism is adjudication — the contract weighs the deliverable as evidence and rules on whether the work is genuine, with an appeal. Not `AI & Agents` (too generic; nearly every project is AI-powered). Not `Marketplaces` (there is no listing/matching engine; the value is the judgment, not the bounty board).

**Category tag 1** (what every user hits)
```
Evidence Assessment
```
Implemented by `adjudicate()`: it reads the submitted deliverable URL on-chain (`gl.nondet.web.render`) and weighs it with an LLM to reach a verdict.

**Category tag 2** (optional branch)
```
Appeal Review
```
Implemented by `appeal()` + a second `adjudicate()` pass: a rejected worker stakes a bond to force a stricter re-review that can overturn the prior ruling.

Alternate tag 2 if you prefer: `Escrow Claims` (every bounty is a conditional escrow released only on a GENUINE verdict). Both are truly implemented; pick whichever the reviewer will most clearly see.

---

## 02 · Summary

**One-liner** (128 / 180)
```
Get paid for real work: an AI jury reads your deliverable on-chain and releases the bounty only when the work is judged genuine.
```

**Description** (931 / 1000)
```
Proof of Sweat is a bounty escrow that pays only for genuine work. A client escrows GEN and writes a spec; a worker stakes and submits a public deliverable URL. GenLayer validators, each running a different model, read the deliverable on-chain and reach consensus on a verdict: GENUINE, AI_GENERATED, PLAGIARIZED, or UNCLEAR, with a confidence score and written reasoning.

If the work is judged genuine with at least 60% confidence, the reward plus stake goes to the worker. Otherwise the bounty is rejected and the worker can appeal with a bond to force a stricter second review. Consensus is on the verdict itself, so two validators that reach different verdicts can never both pass.

Deciding whether a deliverable is genuine human effort or AI slop is a subjective judgment over live web content, which an ordinary smart contract cannot make. Remove the on-chain web reading and the LLM reasoning and the product cannot exist.
```

---

## How to try it

**Before you start:** to just browse, open the site — no wallet needed. Every bounty, verdict, and AI reasoning is visible read-only. To try it hands-on, have MetaMask ready with a little GEN (GenLayer) or USDC (Arc).

**Step 1 — Browse & explore.**
Open the site and scroll the bounty board. Click any settled task to read the AI jury's verdict, confidence score, spec-match, and its written reasoning — all produced on-chain. Visit the **Explorer** tab for a full transparency log of every resolved case.

**Step 2 — Connect & pick your chain.**
Click "Connect MetaMask" in the top right. Your address and balance appear in the header. Use the chain pills (GenLayer / Arc) to switch networks — MetaMask auto-switches. GenLayer settles in GEN; Arc settles in native USDC.

**Step 3 — Claim a task.**
On the "Bounties" board, open a task marked "Open" and click "Claim & stake [amount] [GEN/USDC]". Your collateral is locked as skin-in-the-game. The task moves to "In progress".

**Step 4 — Submit your work.**
Complete the work and host it publicly (gist, PR, blog post). Paste the URL in the modal and click "Submit for review". The task moves to "Awaiting jury". Sample link:
`https://gist.githubusercontent.com/phu1271997/47971261102d0a27411673f960d7fabe/raw/497e1ccd1acfac618916aa47ca64d10942d7736f/deliverable.md`

**Step 5 — Run the AI jury.**
On GenLayer: click "Run the AI jury" and wait ~45 seconds. Validators each run a different LLM, read your deliverable on-chain, and reach consensus on a verdict (Genuine / AI-generated / Plagiarized / Unclear) with confidence, spec-match scores, and written reasoning.
On Arc: the jury runs on GenLayer and the verdict is relayed by an oracle — no manual button needed.

**Step 6 — Get paid (or appeal).**
If the verdict is Genuine (confidence ≥ 60%, spec-match ≥ 50%), the worker is credited reward + stake. Click the glowing "Withdraw [amount] [GEN/USDC]" button in the header to pull funds to your wallet. If rejected, the worker can click "Appeal · bond [amount]" to force a stricter second review. If the worker does not appeal, the client clicks "Finalize & claim escrow" to recover the funds.

**Want to post a task instead?** Go to the "Post" tab, fill in a title, spec, rules, reward, and worker stake (or click "use sample"), and click "Escrow reward & post". A different wallet then claims and submits. If nobody claims it, you can click "Cancel & refund" to get your escrowed reward back.

**Want to see it fail?** In step 4, submit an AI-written or copied page instead. The verdict comes back AI-generated or Plagiarized and no payment is released. The worker can then appeal.

**If you get stuck:** if no result appears, click "Run the AI jury" once more. A MetaMask site warning is a false alarm; the app is safe.

---

## Expected verification outcome (412 / 500)
```
Open the app; reading needs no wallet. You will see three settled bounties decided by GenLayer validator consensus: GENUINE (worker paid), AI_GENERATED, and PLAGIARIZED—each displaying the AI's on-chain reasoning and confidence score. Visit the Explorer tab for full case logs or toggle to Arc to view bounties settled in USDC. Adjudication and settlement transactions can be verified on both explorers.
```

---

## Contract link
```
https://explorer-studio-dev.genlayer.com/address/0x38e53C1BF5128f05D6EAd05b56bdfF4c8305cd68
```
- Address: `0x38e53C1BF5128f05D6EAd05b56bdfF4c8305cd68`
- Network: **GenLayer Studio Next** (Chain ID: `61997`, Consensus v0.6)

## Website
```
https://proofofsweat-app.vercel.app
```

## GitHub
```
https://github.com/phu1271997/proof-of-sweat
```

## Community links (optional)
Leave blank.

---

## Reviewer heads-up (not a form field)
MetaMask may show a Blockaid "malicious/phishing" warning on the `*.vercel.app` domain. It is a false positive on a shared host; the app requests only a normal contract transaction, never a wallet-draining signature. All read-only verification (the three seeded verdicts and their on-chain reasoning) works without connecting a wallet.
