# Field notes: taking the Proof of Sweat jury from one prompt to a three-lens panel

I spent most of a weekend rebuilding the adjudication path of Proof of Sweat, and
these are my own notes on what actually broke and what I changed. I am writing this
the way I debugged it, in order, because the order is where the lessons were.

## Where I started

The old `adjudicate()` did one thing: `web.render(url)` on the deliverable, then a
single `exec_prompt` that returned `{verdict, confidence, spec_match, reason}`.
It worked, but it had a blind spot I kept hitting while testing with real pages:
a slick piece of AI writing would sail through because the one prompt was asked to
do three jobs at once — judge authorship, judge originality, and judge spec fit —
and it tended to average them into a soft "GENUINE, 72". That average is exactly
what you do not want when real money is escrowed on the answer.

## The change that mattered

I split the single judgment into three named lenses in one structured pass:
Forensic Authorship, Originality, and Spec Compliance. Each returns its own 0-100
score and a one-sentence finding, and the final verdict is synthesised from them.
Then I added the piece I actually care about: a second, independent `web.render`
that runs a live quoted search for a distinctive ten-word phrase pulled from the
deliverable. If that exact phrase turns up somewhere else on the web, originality
gets floored and payment is blocked no matter how confident the model sounded.

Payment now needs four gates, not two: verdict GENUINE, plus confidence,
spec-match, authenticity, and originality each over their threshold. I set the two
new thresholds to 55 after watching borderline cases — 50 let too much through, 60
started rejecting honest-but-plain writing.

## The bug that cost me an hour

My first validator still compared the whole result object. Two honest validators
would phrase their `finding` sentences differently and fail consensus every time,
so nothing ever settled. The fix was to compare only the *directional* outcome of
each gate — did each of the five checks land on the same side of its threshold —
and the verdict category. Wording is free to differ; meaning is not. That is the
whole point of the contract, and I had quietly broken it.

## Two things I would warn the next person about

First, don't put `urllib` inside the nondet block. I did, and the deploy to Studio
Next accepted the transaction with `success` while the state never moved — the
sandbox just would not import it. I hand-rolled a tiny percent-encoder instead and
it deployed clean. Trust contract *state*, not the receipt.

Second, the second web read roughly doubles adjudication latency because every
validator re-runs both fetches. On Studio Next a round landed in the twenty-second
range for me, so the frontend has to say "validators are reaching consensus" and
mean it, not spin a generic loader.

## What I would measure next

I only have anecdote on false-positive rate right now. The next deliverable I'd
want is a labelled set of fifty real submissions — half genuine, half AI or copied
— run through the panel so I can report precision and recall per lens instead of
"it felt better". That is the honest gap in this writeup.
