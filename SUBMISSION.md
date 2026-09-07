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

**Before you start:** just looking around needs nothing, no wallet and no sign-up. To try it hands-on, install the MetaMask browser extension and get a little GEN (free test tokens) on the GenLayer studio network.

**Step 1 — Look at the results.**
Open the site and scroll the list of tasks. Click any task to see how the AI judged the work, and why, in plain language.

**Step 2 — Connect (only if you want to try it yourself).**
Click "Connect MetaMask" and approve.

**Step 3 — Let the AI judge a task.**
Open the task marked "awaiting jury" and click "Run the AI jury". Wait a moment for the result to appear.

**Step 4 — Submit your own work.**
Open the task marked "open", click "Claim", then paste this link as the delivered work:
`https://gist.githubusercontent.com/phu1271997/47971261102d0a27411673f960d7fabe/raw/497e1ccd1acfac618916aa47ca64d10942d7736f/deliverable.md`

**Step 5 — Get paid.**
Click "Run the AI jury". If it decides the work is genuine, click "Withdraw" to receive the reward.

**What you'll see:** the AI decides whether the work is real and explains its reasoning. Genuine work gets paid; fake or copied work does not.

**If you get stuck:** if no result appears, click "Run the AI jury" once more. If MetaMask shows a warning, it is a false alarm, the app is safe to use.

---

## Expected verification outcome (496 / 500)
```
Open the app; reading needs no wallet. You will see three settled bounties decided by validator consensus: one GENUINE (95% confidence, worker paid), one AI_GENERATED, and one PLAGIARIZED, each showing the AI's own written reason quoting the deliverable it read. These verdicts were produced on-chain by GenLayer validators, not by the app server. Open any bounty to see the confidence and spec-match scores, and check the contract on the Studio explorer to confirm the adjudication transactions.
```

---

## Contract link
```
https://explorer-studio.genlayer.com/address/0x727Ba3DBB6683c04c34B795fbdAF269e917b01A4
```
- Address: `0x727Ba3DBB6683c04c34B795fbdAF269e917b01A4`
- Network: **studionet** · Status: **Preview** (Studio deployment)

## Website
```
https://proofofsweat.vercel.app
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
