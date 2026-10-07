#!/usr/bin/env node
/**
 * seed_phase1_jury2.js
 *
 * Seeds the v0.4.0 "AI Jury 2.0" contract on GenLayer Studio Next so the
 * Explorer shows the upgraded jury in action:
 *   • a GENUINE case (original first-person deliverable)  -> paid, cross-check CLEAN
 *   • a PLAGIARIZED case (a copied Wikipedia article)     -> rejected, cross-check HIT
 *   • open / claimed / awaiting-jury cases for lifecycle variety
 *
 * Usage:
 *   source ~/.genlayer/env.sh
 *   node scripts/deploy/seed_phase1_jury2.js
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

const CONTRACT = process.env.POS_CONTRACT || '0xF1947cDb029AFd2872775aAe8e1D913821F7Ae05';
const GEN = (n) => BigInt(Math.floor(n * 1e18));

function key(name) {
  let k = process.env[name] || '';
  if (!k) throw new Error(`Missing ${name}`);
  return k.startsWith('0x') ? k : '0x' + k;
}
const w1 = createAccount(key('GENLAYER_PRIVATE_KEY'));
const w2 = createAccount(key('GENLAYER_PRIVATE_KEY_2'));
const w3 = createAccount(key('GENLAYER_PRIVATE_KEY_3'));
const w4 = createAccount(key('GENLAYER_PRIVATE_KEY_4'));
const w5 = createAccount(key('GENLAYER_PRIVATE_KEY_5'));
const C = (a) => createClient({ chain: studioNext, account: a });
const c1 = C(w1), c2 = C(w2), c3 = C(w3), c4 = C(w4), c5 = C(w5);

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
    hash, waitUntil: 'decided', interval: 3000, retries: 150,
  });
  const ok = rcpt.txExecutionResultName === 'FINISHED_WITH_RETURN';
  console.log(`${tag} — ${ok ? '✅' : '❌'} ${rcpt.txExecutionResultName}`);
  return ok;
}
async function read(fn, args = []) {
  return c1.readContract({ address: CONTRACT, functionName: fn, args });
}
async function newId() {
  const all = JSON.parse(await read('get_all_bounties'));
  return String(all.length - 1);
}

async function main() {
  console.log('Seeding AI Jury 2.0 contract:', CONTRACT);

  // ── OPEN bounties ──────────────────────────────────────────────────────────
  await send(c1, 'create_bounty', [
    'Technical deep-dive: GenLayer optimistic democracy',
    'Write an original, first-person engineering analysis of how GenLayer reaches subjective consensus across validators running different LLMs. Cover leader/validator roles, the appeal path, and finality.',
    'Original first-hand writing only. No AI boilerplate, no copied sources.',
    GEN(0.5),
  ], GEN(2.0), 'Open: consensus deep-dive');

  await send(c4, 'create_bounty', [
    'Design a Proof of Sweat explainer infographic',
    'Produce an original infographic that explains the bounty lifecycle: post, claim, submit, AI jury, verdict, payout.',
    'Original vector artwork; link a public page the jury can read.',
    GEN(1.0),
  ], GEN(4.0), 'Open: infographic');

  // ── CLAIMED (in progress) ──────────────────────────────────────────────────
  await send(c1, 'create_bounty', [
    'Write a "Getting started on Studio Next" tutorial',
    'A beginner tutorial: install the toolkit, write an intelligent contract, deploy to Studio Next, call it from a dApp.',
    'Step-by-step with tested commands; original writing.',
    GEN(0.5),
  ], GEN(3.0), 'Create: tutorial');
  const idTut = await newId();
  await send(c2, 'claim_bounty', [idTut], GEN(0.5), 'Claim: tutorial (w2)');

  // ── SUBMITTED (awaiting jury) ──────────────────────────────────────────────
  await send(c4, 'create_bounty', [
    'Benchmark note: consensus latency on Studio Next',
    'Measure and report wall-clock latency for a nondet adjudication round, with raw numbers and method.',
    'Original measurements, public link.',
    GEN(0.5),
  ], GEN(2.5), 'Create: benchmark');
  const idBench = await newId();
  await send(c5, 'claim_bounty', [idBench], GEN(0.5), 'Claim: benchmark (w5)');
  await send(c5, 'submit_work', [idBench,
    'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/CHANGELOG.md'],
    0n, 'Submit: benchmark');

  // ── GENUINE -> APPROVED (original first-person deliverable) ─────────────────
  await send(c1, 'create_bounty', [
    'In-depth architecture analysis of Proof of Sweat',
    'Original first-person engineering analysis of Proof of Sweat: the subjective-consensus jury over meaning, the escrow + slashing game theory, the Arc USDC settlement, and performance on Studio Next.',
    'Must be original first-person engineering analysis. Provide a raw markdown link.',
    GEN(0.5),
  ], GEN(2.0), 'Create: GENUINE case');
  const idGood = await newId();
  await send(c2, 'claim_bounty', [idGood], GEN(0.5), 'Claim: GENUINE (w2)');
  await send(c2, 'submit_work', [idGood,
    'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/docs/samples/genuine_deliverable.md'],
    0n, 'Submit: GENUINE');
  console.log('→ Running AI Jury 2.0 (expect GENUINE, clean cross-check, PAID)…');
  await send(c1, 'adjudicate', [idGood], 0n, 'Adjudicate: GENUINE case');
  const bGood = JSON.parse(await read('get_bounty', [idGood]));
  console.log('   verdict:', bGood.verdict, '| auth:', bGood.authenticity,
    '| orig:', bGood.originality, '| cross_check:', bGood.cross_check, '| status:', bGood.status);

  // ── PLAGIARIZED -> REJECTED (copied Wikipedia article, live cross-check HIT) ─
  await send(c4, 'create_bounty', [
    'Original explainer: how escrow works in on-chain marketplaces',
    'Write an original explainer, in your own words, of how escrow protects buyers and sellers in on-chain marketplaces.',
    'Must be YOUR OWN words. Copying an existing article is an automatic fail.',
    GEN(0.5),
  ], GEN(2.0), 'Create: PLAGIARIZED case');
  const idBad = await newId();
  await send(c3, 'claim_bounty', [idBad], GEN(0.5), 'Claim: PLAGIARIZED (w3)');
  // Worker cheats by pasting the public Wikipedia "Escrow" article.
  await send(c3, 'submit_work', [idBad, 'https://en.wikipedia.org/wiki/Escrow'],
    0n, 'Submit: PLAGIARIZED (copied Wikipedia)');
  console.log('→ Running AI Jury 2.0 (expect PLAGIARIZED, cross-check HIT, REJECTED)…');
  await send(c4, 'adjudicate', [idBad], 0n, 'Adjudicate: PLAGIARIZED case');
  const bBad = JSON.parse(await read('get_bounty', [idBad]));
  console.log('   verdict:', bBad.verdict, '| orig:', bBad.originality,
    '| cross_check:', bBad.cross_check, '| status:', bBad.status);

  console.log('\n==================================================');
  const all = JSON.parse(await read('get_all_bounties'));
  console.log(`🎉 Seeding done. Total bounties: ${all.length}`);
  console.log('==================================================');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
