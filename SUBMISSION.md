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

**Before you start:** to just look around, open the site, no wallet needed. To try it hands-on, connect MetaMask with a little GEN on the GenLayer studio network.

**Step 1 — Connect.**
Open the app, click "Connect MetaMask", and approve the switch to the GenLayer studio network.

**Step 2 — Claim a task.**
Open a task marked "Open" and click "Claim & stake". You are now the worker.

**Step 3 — Submit your work.**
Click "Submit for review" and paste a public link to the delivered work. Sample link:
`https://gist.githubusercontent.com/phu1271997/47971261102d0a27411673f960d7fabe/raw/497e1ccd1acfac618916aa47ca64d10942d7736f/deliverable.md`

**Step 4 — Run the AI jury.**
Click "Run the AI jury" and wait a moment. The AI reads your work and returns a verdict with its reasoning.

**Step 5 — Get paid.**
If the verdict is Genuine, click "Withdraw" to receive the reward plus your stake.

**Want to see it fail?** In step 3, submit an AI-written or copied page instead; the verdict comes back AI-generated or Plagiarized and no payment is released. The worker can then click "Appeal".

**Prefer to post a task?** Use the "Post a bounty" tab, fill in the details (or click "use sample"), and click "Escrow reward & post". A different wallet then claims and submits.

**If you get stuck:** if no result appears, click "Run the AI jury" once more. A MetaMask site warning is a false alarm; the app is safe.

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
