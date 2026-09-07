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

**Prerequisites**
- A browser. Reading the board and every verdict needs no wallet.
- To transact (claim, run the jury, appeal, withdraw): MetaMask with a little GEN on GenLayer studionet.

**Step 1 — Read settled verdicts (no wallet).**
Open the app and scroll the bounty board. Open the GENUINE, AI_GENERATED, and PLAGIARIZED bounties to read the AI's own on-chain reasoning and its confidence and spec-match scores.

**Step 2 — Connect.**
Click Connect MetaMask and approve the switch to GenLayer studionet.

**Step 3 — Run the AI jury.**
Open the bounty labelled "awaiting jury" and click Run the AI jury. Wait for validator consensus; a verdict appears on the card.

**Step 4 — Claim and submit genuine work.**
Open the "open" bounty, click Claim & stake 1 GEN, then submit this deliverable URL:
`https://gist.githubusercontent.com/phu1271997/47971261102d0a27411673f960d7fabe/raw/497e1ccd1acfac618916aa47ca64d10942d7736f/deliverable.md`

**Step 5 — Get paid.**
Click Run the AI jury. On a GENUINE verdict, click Withdraw to receive the reward plus your stake.

**Expected end state:** a GENUINE verdict with a written reason, and GEN credited then withdrawn to your wallet.

**If something goes wrong:**
- Consensus undetermined (state did not change): click Run the AI jury again.
- Wrong network: reconnect to switch to studionet.
- MetaMask shows a site warning: it is a Blockaid false positive. Reading needs no wallet; you can proceed to transact safely (the contract only escrows a bounty, it never requests draining signatures).

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
