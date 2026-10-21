#!/usr/bin/env node
/**
 * seed_phase4_skeptics_market.js
 *
 * Seeds the v0.6.0 "Skeptics' Market" contract on GenLayer Studio Next so the
 * live app shows a staked, AI-settled second opinion running end-to-end on-chain:
 *   1. A GENUINE bounty is posted, claimed, submitted and PAID by the AI jury.
 *   2. A Skeptics' Market challenge is OPENED on that paid verdict — wallet A
 *      stakes on FAKE (the skeptic), wallet B stakes on GENUINE (the defender).
 *   3. After the stake window closes, resolve_challenge runs the SAME on-chain AI
 *      courtroom again as a trustless settler. GENUINE is upheld, the GENUINE side
 *      takes the whole pot, and the winner withdraws real GEN.
 *
 * Two funded keystore wallets (A = GENLAYER_PRIVATE_KEY_2, B = GENLAYER_PRIVATE_KEY_5).
 *
 * Usage:
 *   source ~/.genlayer/env.sh
 *   POS_CONTRACT=0x... node scripts/deploy/seed_phase4_skeptics_market.js
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

const CONTRACT = process.env.POS_CONTRACT || '0x1fC085D937fbDCee73f9c4C5A1bcB767346716Fe';
const GEN = (n) => BigInt(Math.floor(n * 1e18));
const REWARD = GEN(0.05);
const STAKE = GEN(0.01);
const FAKE_STAKE = GEN(0.01);     // wallet A bets the work is fraud
const GENUINE_STAKE = GEN(0.02);  // wallet B bets the work is genuine

function key(name) {
  let k = process.env[name] || '';
  if (!k) throw new Error(`Missing ${name}`);
  return k.startsWith('0x') ? k : '0x' + k;
}
const A = createAccount(key('GENLAYER_PRIVATE_KEY_2'));
const B = createAccount(key('GENLAYER_PRIVATE_KEY_5'));
const C = (a) => createClient({ chain: studioNext, account: a });
const ca = C(A), cb = C(B);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  console.log("Seeding Skeptics' Market (v0.6.0) contract:", CONTRACT);
  console.log('A (skeptic/client):', A.address, '· B (defender/worker):', B.address);

  const cfg = JSON.parse(await read('get_config'));
  const windowSecs = Number(cfg.challenge_window_secs || 180);
  console.log('challenge_window_secs =', windowSecs);

  // 1) GENUINE bounty → jury pays the worker (B).
  await send(ca, 'create_bounty', [
    'First-person field note: deploying an Intelligent Contract to Studio Next',
    'Write an original, first-person account of designing and shipping the Proof of Sweat jury: the subjective-consensus verdict over meaning, the escrow + slashing game theory, and what was hard on Studio Next.',
    'Original first-hand writing only. No AI boilerplate, no copied sources.',
    STAKE,
  ], REWARD, 'Create: GENUINE bounty');
  const bid = await newId();
  await send(cb, 'claim_bounty', [bid], STAKE, 'Claim: GENUINE (B)');
  await send(cb, 'submit_work', [bid,
    'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/docs/samples/genuine_deliverable.md'],
    0n, 'Submit: GENUINE deliverable');
  console.log('→ Running the AI jury (expect GENUINE, worker PAID)…');
  await send(ca, 'adjudicate', [bid], 0n, 'Adjudicate');
  let b = JSON.parse(await read('get_bounty', [bid]));
  console.log('   verdict:', b.verdict, '| status:', b.status, '(3 = APPROVED/paid)');

  if (Number(b.status) !== 3) {
    console.log('⚠️  Jury did not approve this round; opening the market anyway on the resolved verdict.');
  }

  // 2) Open the Skeptics' Market on the resolved verdict.
  console.log("→ Opening a Skeptics' Market challenge (A stakes FAKE, the skeptic)…");
  await send(ca, 'open_challenge', [bid, 'FAKE'], FAKE_STAKE, 'open_challenge (FAKE)');
  console.log('→ B backs GENUINE (the defender)…');
  await send(cb, 'back_challenge', [bid, 'GENUINE'], GENUINE_STAKE, 'back_challenge (GENUINE)');

  let ch = JSON.parse(await read('get_challenge', [bid]));
  console.log(`   pot_fake=${ch.pot_fake} pot_genuine=${ch.pot_genuine} total=${ch.pot_total}`);
  console.log(`   closes_at=${ch.closes_at} (window ${windowSecs}s) — waiting it out…`);

  // 3) Wait for the stake window to close, then settle with a fresh re-trial.
  await sleep((windowSecs + 15) * 1000);
  console.log('→ Window closed. Running resolve_challenge (fresh on-chain AI re-trial settles the pot)…');
  await send(ca, 'resolve_challenge', [bid], 0n, 'resolve_challenge');

  ch = JSON.parse(await read('get_challenge', [bid]));
  const sideName = { 0: 'NONE/VOID', 1: 'GENUINE', 2: 'FAKE' }[ch.winning_side];
  console.log('   fresh_verdict:', ch.fresh_verdict, '| winning_side:', sideName,
    '| overturned:', ch.overturned, '| status:', ch.status);
  console.log('   fresh_reason:', (ch.fresh_reason || '').slice(0, 110));

  // 4) Winner withdraws real GEN.
  const winnerCredit = await read('get_credit', [B.address.toLowerCase()]);
  console.log('   B withdrawable credit:', winnerCredit);
  if (BigInt(winnerCredit) > 0n) {
    await send(cb, 'withdraw', [], 0n, 'withdraw (winner B)');
  }

  console.log('\n==================================================');
  const all = JSON.parse(await read('get_all_challenges'));
  console.log(`🎉 Skeptics' Market seeded. Total challenges: ${all.length}`);
  console.log('==================================================');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
