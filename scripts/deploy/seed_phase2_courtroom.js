#!/usr/bin/env node
/**
 * seed_phase2_courtroom.js
 *
 * Seeds the v0.5.0 "AI Courtroom" contract on GenLayer Studio Next so the live
 * app shows the adversarial deliberation in action:
 *   • a GENUINE case  — original first-person deliverable -> prosecution + defense
 *     briefs argued on-chain, defense prevails, worker PAID (cross-check CLEAN).
 *   • a PLAGIARIZED case — a copied Wikipedia article -> prosecution brief cites the
 *     live web cross-check HIT, REJECTED into the protected appeal window.
 *   • an APPEAL WITH A WRITTEN REBUTTAL on that plagiarized case — the worker's plea
 *     is admitted into evidence on-chain; the re-trial still upholds fraud because the
 *     verbatim web match is concrete evidence you can't argue away.
 *   • open / claimed / awaiting-jury cases for lifecycle variety.
 *
 * Uses the two funded keystore wallets (client/worker roles swap per case).
 *
 * Usage:
 *   source ~/.genlayer/env.sh
 *   POS_CONTRACT=0x... node scripts/deploy/seed_phase2_courtroom.js
 */
const path = require('path');
const { createClient, createAccount } = require(
  path.resolve(__dirname, '../../frontend/node_modules/genlayer-js')
);
const { studioDevnet } = require(
  path.resolve(__dirname, '../../frontend/node_modules/genlayer-js/dist/chains/index.cjs')
);

const studioNext = {
  ...studioDevnet,
  id: 61997,
  name: 'GenLayer Studio Next',
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
};

const CONTRACT = process.env.POS_CONTRACT || '0x8EFD51C83e606B1adCd95E14b73DD17967Ef20F0';
const GEN = (n) => BigInt(Math.floor(n * 1e18));
const REWARD = GEN(0.2);
const STAKE = GEN(0.05);

function key(name) {
  let k = process.env[name] || '';
  if (!k) throw new Error(`Missing ${name}`);
  return k.startsWith('0x') ? k : '0x' + k;
}
// Two funded wallets; they swap client/worker roles so no self-claim ever happens.
const A = createAccount(key('GENLAYER_PRIVATE_KEY_2'));
const B = createAccount(key('GENLAYER_PRIVATE_KEY_5'));
const C = (a) => createClient({ chain: studioNext, account: a });
const ca = C(A), cb = C(B);

let n = 0;
async function send(client, fn, args, value = 0n, label) {
  n++;
  const tag = `[#${n}] ${label}`;
  const fees = await client.estimateTransactionFees({});
  const opts = { address: CONTRACT, functionName: fn, args, fees };
  if (value > 0n) opts.value = value;
  const hash = await client.writeContract(opts);
  console.log(`${tag} — ${hash.slice(0, 12)}… waiting…`);
  const rcpt = await client.waitForTransactionReceipt({
    hash, waitUntil: 'decided', interval: 3000, retries: 200,
  });
  const ok = rcpt.txExecutionResultName === 'FINISHED_WITH_RETURN';
  console.log(`${tag} — ${ok ? '✅' : '❌'} ${rcpt.txExecutionResultName}`);
  return ok;
}
async function read(fn, args = []) {
  return ca.readContract({ address: CONTRACT, functionName: fn, args });
}
async function newId() {
  const all = JSON.parse(await read('get_all_bounties'));
  return String(all.length - 1);
}

async function main() {
  console.log('Seeding AI Courtroom (v0.5.0) contract:', CONTRACT);
  console.log('client/worker wallets:', A.address, '·', B.address);

  // ── OPEN bounties (lifecycle variety) ──────────────────────────────────────
  await send(ca, 'create_bounty', [
    'Technical deep-dive: GenLayer optimistic democracy',
    'Write an original, first-person engineering analysis of how GenLayer reaches subjective consensus across validators running different LLMs. Cover leader/validator roles, the appeal path, and finality.',
    'Original first-hand writing only. No AI boilerplate, no copied sources.',
    STAKE,
  ], REWARD, 'Open: consensus deep-dive');

  await send(cb, 'create_bounty', [
    'Write a "Getting started on Studio Next" tutorial',
    'A beginner tutorial: install the toolkit, write an intelligent contract, deploy to Studio Next, call it from a dApp.',
    'Step-by-step with tested commands; original writing.',
    STAKE,
  ], REWARD, 'Open: tutorial');

  // ── SUBMITTED (awaiting jury — a visitor can run the courtroom live) ────────
  await send(ca, 'create_bounty', [
    'Benchmark note: consensus latency on Studio Next',
    'Measure and report wall-clock latency for a nondet adjudication round, with raw numbers and method.',
    'Original measurements, public link.',
    STAKE,
  ], REWARD, 'Create: benchmark');
  const idBench = await newId();
  await send(cb, 'claim_bounty', [idBench], STAKE, 'Claim: benchmark (B)');
  await send(cb, 'submit_work', [idBench,
    'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/CHANGELOG.md'],
    0n, 'Submit: benchmark (awaiting jury)');

  // ── GENUINE -> courtroom -> APPROVED (original first-person deliverable) ────
  await send(ca, 'create_bounty', [
    'In-depth architecture analysis of Proof of Sweat',
    'Original first-person engineering analysis of Proof of Sweat: the subjective-consensus jury over meaning, the escrow + slashing game theory, the Arc USDC settlement, and performance on Studio Next.',
    'Must be original first-person engineering analysis. Provide a raw markdown link.',
    STAKE,
  ], REWARD, 'Create: GENUINE case');
  const idGood = await newId();
  await send(cb, 'claim_bounty', [idGood], STAKE, 'Claim: GENUINE (B)');
  await send(cb, 'submit_work', [idGood,
    'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/docs/samples/genuine_deliverable.md'],
    0n, 'Submit: GENUINE');
  console.log('→ Running the AI courtroom (expect defense prevails, GENUINE, PAID)…');
  await send(ca, 'adjudicate', [idGood], 0n, 'Adjudicate: GENUINE case');
  const bGood = JSON.parse(await read('get_bounty', [idGood]));
  console.log('   verdict:', bGood.verdict, '| auth:', bGood.authenticity,
    '| orig:', bGood.originality, '| cross_check:', bGood.cross_check, '| status:', bGood.status);
  console.log('   prosecution:', (bGood.prosecution || '').slice(0, 90));
  console.log('   defense    :', (bGood.defense || '').slice(0, 90));

  // ── PLAGIARIZED -> courtroom -> REJECTED -> APPEAL w/ REBUTTAL -> upheld ─────
  await send(cb, 'create_bounty', [
    'Original explainer: how escrow works in on-chain marketplaces',
    'Write an original explainer, in your own words, of how escrow protects buyers and sellers in on-chain marketplaces.',
    'Must be YOUR OWN words. Copying an existing article is an automatic fail.',
    STAKE,
  ], REWARD, 'Create: PLAGIARIZED case');
  const idBad = await newId();
  await send(ca, 'claim_bounty', [idBad], STAKE, 'Claim: PLAGIARIZED (A)');
  await send(ca, 'submit_work', [idBad, 'https://en.wikipedia.org/wiki/Escrow'],
    0n, 'Submit: PLAGIARIZED (copied Wikipedia)');
  console.log('→ Running the AI courtroom (expect prosecution cites cross-check HIT, REJECTED)…');
  await send(cb, 'adjudicate', [idBad], 0n, 'Adjudicate: PLAGIARIZED case');
  let bBad = JSON.parse(await read('get_bounty', [idBad]));
  console.log('   verdict:', bBad.verdict, '| orig:', bBad.originality,
    '| cross_check:', bBad.cross_check, '| status:', bBad.status);

  if (Number(bBad.status) === 4) {
    console.log('→ Worker appeals WITH a written rebuttal (admitted into evidence)…');
    const plea =
      'I summarised this in my own words from public sources and only reused standard escrow terminology; ' +
      'please re-read the body before ruling it copied.';
    await send(ca, 'appeal', [idBad, plea], STAKE, 'Appeal: PLAGIARIZED w/ rebuttal (A)');
    console.log('→ Re-running the courtroom on appeal (verbatim web match is concrete; expect fraud upheld)…');
    await send(cb, 'adjudicate', [idBad], 0n, 'Re-adjudicate: appeal');
    bBad = JSON.parse(await read('get_bounty', [idBad]));
    console.log('   verdict:', bBad.verdict, '| status:', bBad.status, '| appealed:', bBad.appealed);
    console.log('   rebuttal on record:', (bBad.rebuttal || '').slice(0, 80));
    console.log('   prosecution:', (bBad.prosecution || '').slice(0, 90));
    console.log('   defense    :', (bBad.defense || '').slice(0, 90));
  }

  console.log('\n==================================================');
  const all = JSON.parse(await read('get_all_bounties'));
  console.log(`🎉 Seeding done. Total bounties: ${all.length}`);
  console.log('==================================================');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
