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

Every verdict is argued as an on-chain adversarial trial: one AI pass writes a Prosecution brief and a Defense brief from the same evidence, and a second pass acts as the judge that weighs both before ruling. If the work is judged genuine, the reward plus stake goes to the worker; otherwise it is rejected and the worker can appeal with a bond and a written rebuttal that is admitted into evidence. Consensus is on the verdict itself, so two validators that reach different verdicts can never both pass.

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
On GenLayer: click "Run the AI jury" and wait ~45 seconds. Validators each run a different LLM, read your deliverable on-chain, argue a Prosecution brief and a Defense brief, then rule — reaching consensus on a verdict (Genuine / AI-generated / Plagiarized / Unclear) with confidence, spec-match scores, both briefs, and written reasoning, all shown in the AI Courtroom panel.
On Arc: the jury runs on GenLayer and the verdict is relayed by an oracle — no manual button needed.

**Step 6 — Get paid (or appeal).**
If the verdict is Genuine (confidence ≥ 60%, spec-match ≥ 50%), the worker is credited reward + stake. Click the glowing "Withdraw [amount] [GEN/USDC]" button in the header to pull funds to your wallet. If rejected, the worker can type a rebuttal and click "Appeal · bond [amount]" to force a stricter second trial in which the AI defense must engage with that rebuttal. If the worker does not appeal within the protected window, the client clicks "Finalize & claim escrow" to recover the funds.

**Want to post a task instead?** Go to the "Post" tab, fill in a title, spec, rules, reward, and worker stake (or click "use sample"), and click "Escrow reward & post". A different wallet then claims and submits. If nobody claims it, you can click "Cancel & refund" to get your escrowed reward back.

**Want to see it fail?** In step 4, submit an AI-written or copied page instead. The verdict comes back AI-generated or Plagiarized and no payment is released. The worker can then appeal.

**If you get stuck:** if no result appears, click "Run the AI jury" once more. A MetaMask site warning is a false alarm; the app is safe.

---

## Expected verification outcome (499 / 500)
```
Open the app; reading needs no wallet. Open a settled bounty to see the AI Courtroom panel: the Prosecution and Defense briefs the validators argued on-chain, plus confidence, spec-match, authenticity and originality. A GENUINE first-person deliverable (authenticity 91, originality 93, web cross-check clean) had its Defense brief prevail and paid the worker. A copied Wikipedia article was ruled PLAGIARIZED (originality 2) by the Prosecution brief and rejected; the worker then appealed with a written rebuttal admitted into evidence, and the re-trial still upheld fraud because the verbatim source match is concrete. All data is read from the contract.
```

---

## Contract link
```
https://explorer-studio-dev.genlayer.com/address/0x8EFD51C83e606B1adCd95E14b73DD17967Ef20F0
```
- Address: `0x8EFD51C83e606B1adCd95E14b73DD17967Ef20F0` (v0.5.0 — AI Courtroom, adversarial deliberation)
- Network: **GenLayer Studio Next** (Chain ID: `61997`, Consensus v0.6)

## Website
```
https://proofofsweat-app-omega.vercel.app
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
