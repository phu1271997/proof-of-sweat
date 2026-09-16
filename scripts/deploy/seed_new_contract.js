#!/usr/bin/env node
/**
 * seed_new_contract.js
 * Seeds the newly deployed fixed contract (0x38e53C1BF5128f05D6EAd05b56bdfF4c8305cd68)
 * with a full set of bounties across all 8 lifecycle statuses using all 5 wallets.
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

function getKey(name) {
  let k = process.env[name] || '';
  if (!k) throw new Error(`Missing ${name}`);
  if (!k.startsWith('0x')) k = '0x' + k;
  return k;
}

const w1 = createAccount(getKey('GENLAYER_PRIVATE_KEY'));
const w2 = createAccount(getKey('GENLAYER_PRIVATE_KEY_2'));
const w3 = createAccount(getKey('GENLAYER_PRIVATE_KEY_3'));
const w4 = createAccount(getKey('GENLAYER_PRIVATE_KEY_4'));
const w5 = createAccount(getKey('GENLAYER_PRIVATE_KEY_5'));

const c1 = createClient({ chain: studioNext, account: w1 });
const c2 = createClient({ chain: studioNext, account: w2 });
const c3 = createClient({ chain: studioNext, account: w3 });
const c4 = createClient({ chain: studioNext, account: w4 });
const c5 = createClient({ chain: studioNext, account: w5 });

const CONTRACT = '0x38e53C1BF5128f05D6EAd05b56bdfF4c8305cd68';
const GEN = (n) => BigInt(Math.floor(n * 1e18));

let count = 0;

async function send(client, fn, args, value = 0n, label) {
  count++;
  const tag = `[#${count}] ${label}`;
  console.log(`${tag} — submitting...`);
  const fees = await client.estimateTransactionFees({});
  const opts = { address: CONTRACT, functionName: fn, args, fees };
  if (value > 0n) opts.value = value;
  const hash = await client.writeContract(opts);
  console.log(`${tag} — tx: ${hash.slice(0, 18)}… waiting…`);
  const rcpt = await client.waitForTransactionReceipt({
    hash, waitUntil: 'decided', interval: 2500, retries: 80,
  });
  const ok = rcpt.txExecutionResultName === 'FINISHED_WITH_RETURN';
  console.log(`${tag} — ${ok ? '✅' : '❌'} ${rcpt.txExecutionResultName}`);
  return ok;
}

async function read(fn, args = []) {
  return c1.readContract({ address: CONTRACT, functionName: fn, args });
}

async function getNextId() {
  const all = JSON.parse(await read('get_all_bounties'));
  return String(all.length - 1);
}

async function main() {
  console.log('Seeding contract:', CONTRACT);

  // 1. Genesis Bounty (OPEN) - Client 1
  console.log('\n--- 1. Genesis Bounty (OPEN) ---');
  await send(c1, 'create_bounty', [
    'GenLayer Studio Next Genesis Bounty',
    'Write a high-quality technical analysis comparing GenLayer subjective consensus to optimistic and ZK rollups.',
    'Must cite specific GenVM architecture details, no AI boilerplate.',
    GEN(0.5)
  ], GEN(1.0), 'Create Genesis');

  // 2. Open Bounties
  console.log('\n--- 2. OPEN Bounties ---');
  await send(c4, 'create_bounty', [
    '🎨 Design a Proof of Sweat logo and brand kit',
    'Create an SVG logo, color palette, and social media banners for the Proof of Sweat platform.',
    'Original vector assets only.',
    GEN(1.0)
  ], GEN(5.0), 'Create Brand Kit (OPEN)');

  await send(c5, 'create_bounty', [
    '📊 Build a GenLayer ecosystem analytics dashboard',
    'Interactive web dashboard displaying validator metrics, gas fees, and active smart contracts.',
    'Clean React or Vue implementation with live charts.',
    GEN(1.5)
  ], GEN(8.0), 'Create Analytics (OPEN)');

  await send(c1, 'create_bounty', [
    '🔐 Security audit report for an Intelligent Contract',
    'Audit prompt injection vulnerabilities, validator consensus edge cases, and reentrancy vectors.',
    'Structured vulnerability report with severity matrix.',
    GEN(2.0)
  ], GEN(10.0), 'Create Audit (OPEN)');

  // 3. Claimed Bounties (Worker 2 and Worker 5)
  console.log('\n--- 3. CLAIMED Bounties ---');
  await send(c1, 'create_bounty', [
    '📝 Write a "Getting Started with GenLayer" tutorial',
    'Beginner tutorial covering environment setup, intelligent contract syntax, and deployment.',
    'Step by step instructions with tested code samples.',
    GEN(0.5)
  ], GEN(3.0), 'Create Tutorial');
  const idTutorial = await getNextId();
  await send(c2, 'claim_bounty', [idTutorial], GEN(0.5), 'Claim Tutorial (Worker 2)');

  await send(c4, 'create_bounty', [
    '⚡ High-throughput WebSocket event indexer for GenLayer',
    'Build a real-time event listener subscribing to GenLayer block activation.',
    'Sub-second latency with automatic reconnect.',
    GEN(1.0)
  ], GEN(5.0), 'Create Indexer');
  const idIndexer = await getNextId();
  await send(c5, 'claim_bounty', [idIndexer], GEN(1.0), 'Claim Indexer (Worker 5)');

  // 4. Submitted Bounties
  console.log('\n--- 4. SUBMITTED Bounties ---');
  await send(c1, 'create_bounty', [
    '🧪 Comprehensive test suite for GenLayer boilerplate',
    'Pytest test suite verifying football_bets.py contract and mock LLM edge cases.',
    'Minimum 15 passing test cases.',
    GEN(0.5)
  ], GEN(2.5), 'Create Test Suite');
  const idTest = await getNextId();
  await send(c2, 'claim_bounty', [idTest], GEN(0.5), 'Claim Test Suite');
  await send(c2, 'submit_work', [idTest, 'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/README.md'], 0n, 'Submit Test Suite');

  await send(c4, 'create_bounty', [
    '📱 Mobile-responsive redesign of a GenLayer dApp',
    'Responsive styling pass for Proof of Sweat across mobile viewports.',
    'No layout breakage, touch friendly controls.',
    GEN(0.8)
  ], GEN(3.5), 'Create Mobile Redesign');
  const idMobile = await getNextId();
  await send(c5, 'claim_bounty', [idMobile], GEN(0.8), 'Claim Mobile Redesign');
  await send(c5, 'submit_work', [idMobile, 'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/SUBMISSION.md'], 0n, 'Submit Mobile Redesign');

  // 5. APPROVED Bounty (AI Jury rules GENUINE + Payment Approved!)
  console.log('\n--- 5. APPROVED Bounty ---');
  await send(c1, 'create_bounty', [
    '📝 In-depth architecture & performance analysis of Proof of Sweat',
    'Write an original, in-depth technical analysis of Proof of Sweat by an infrastructure engineer. Must cover: the core subjective consensus mechanism over meaning, the game-theoretic escrow and slashing rules, the dual-chain Arc settlement integration in native USDC, and empirical performance metrics on GenLayer Studio Next.',
    'Must be original first-person engineering analysis. Provide raw markdown link.',
    GEN(0.5)
  ], GEN(2.0), 'Create Approved Case');
  const idApproved = await getNextId();
  await send(c2, 'claim_bounty', [idApproved], GEN(0.5), 'Claim Approved Case');
  await send(c2, 'submit_work', [idApproved, 'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/demo_deliverable.md'], 0n, 'Submit Approved Case');
  console.log('Running AI Jury on Approved Case (expecting GENUINE + consensus on payment)...');
  await send(c1, 'adjudicate', [idApproved], 0n, 'Adjudicate Approved Case');
  const bApp = JSON.parse(await read('get_bounty', [idApproved]));
  console.log('Result for Approved Case:', bApp.verdict, 'conf:', bApp.confidence, 'status:', bApp.status, '(3=APPROVED)');

  // 6. REJECTED Bounty (AI Jury rules PLAGIARIZED / OFF-SPEC)
  console.log('\n--- 6. REJECTED Bounty ---');
  await send(c4, 'create_bounty', [
    '🔍 Research: Zero-knowledge proofs in validator networks',
    'Technical breakdown of ZK-SNARKs for state verification in GenLayer.',
    'Academic rigor with citations.',
    GEN(0.5)
  ], GEN(3.0), 'Create ZK Research');
  const idZk = await getNextId();
  await send(c5, 'claim_bounty', [idZk], GEN(0.5), 'Claim ZK Research');
  await send(c5, 'submit_work', [idZk, 'https://docs.github.com/en/get-started/quickstart/hello-world'], 0n, 'Submit ZK Research');
  console.log('Running AI Jury on ZK Research (expecting REJECTED)...');
  await send(c4, 'adjudicate', [idZk], 0n, 'Adjudicate ZK Research');
  const bZk = JSON.parse(await read('get_bounty', [idZk]));
  console.log('Result for ZK Research:', bZk.verdict, 'status:', bZk.status, '(4=REJECTED)');

  // 7. APPEALED Bounty (Rejected -> Appealed with bond by Worker 3)
  console.log('\n--- 7. APPEALED Bounty ---');
  await send(c1, 'create_bounty', [
    '✍️ Personal essay: "Why I believe in subjective consensus"',
    'A 1000-word personal essay reflecting on subjective consensus and decentralized intelligence.',
    'Authentic first-person writing.',
    GEN(0.3)
  ], GEN(1.5), 'Create Essay');
  const idEssay = await getNextId();
  await send(c3, 'claim_bounty', [idEssay], GEN(0.3), 'Claim Essay');
  await send(c3, 'submit_work', [idEssay, 'https://docs.github.com/en'], 0n, 'Submit Essay');
  console.log('Adjudicating essay...');
  await send(c1, 'adjudicate', [idEssay], 0n, 'Adjudicate Essay');
  console.log('Worker 3 appealing with appeal bond...');
  await send(c3, 'appeal', [idEssay], GEN(0.3), 'Appeal Essay');
  const bEssay = JSON.parse(await read('get_bounty', [idEssay]));
  console.log('Result for Essay:', bEssay.status, '(5=APPEALED)');

  // 8. RESOLVED_FRAUD Bounty (Rejected -> Finalized by Client)
  console.log('\n--- 8. RESOLVED_FRAUD Bounty ---');
  await send(c5, 'create_bounty', [
    '📋 GenLayer developer onboarding checklist & FAQ',
    'Comprehensive developer onboarding documentation and FAQ list.',
    'Accurate tested markdown guide.',
    GEN(0.4)
  ], GEN(2.0), 'Create FAQ');
  const idFaq = await getNextId();
  await send(c4, 'claim_bounty', [idFaq], GEN(0.4), 'Claim FAQ');
  await send(c4, 'submit_work', [idFaq, 'https://docs.github.com/en'], 0n, 'Submit FAQ');
  console.log('Adjudicating FAQ...');
  await send(c5, 'adjudicate', [idFaq], 0n, 'Adjudicate FAQ');
  console.log('Finalizing rejection by client 5...');
  await send(c5, 'finalize_rejection', [idFaq], 0n, 'Finalize FAQ Fraud');
  const bFaq = JSON.parse(await read('get_bounty', [idFaq]));
  console.log('Result for FAQ:', bFaq.status, '(6=RESOLVED_FRAUD)');

  // 9. CANCELLED Bounties
  console.log('\n--- 9. CANCELLED Bounties ---');
  await send(c1, 'create_bounty', [
    '❌ [Cancelled] Video walkthrough of GenLayer Studio',
    '10-minute narrated screen recording of GenLayer Studio IDE.',
    'HD quality video.',
    GEN(0.2)
  ], GEN(1.0), 'Create Video');
  const idVideo = await getNextId();
  await send(c1, 'cancel_bounty', [idVideo], 0n, 'Cancel Video');

  await send(c4, 'create_bounty', [
    '❌ [Cancelled] Deprecated Python 3.10 compatibility layer',
    'Python 3.10 runtime shims for legacy contracts.',
    'No longer needed.',
    GEN(0.3)
  ], GEN(1.5), 'Create Shims');
  const idShims = await getNextId();
  await send(c4, 'cancel_bounty', [idShims], 0n, 'Cancel Shims');

  console.log('\n==================================================');
  console.log('🎉 SEEDING COMPLETED!');
  const all = JSON.parse(await read('get_all_bounties'));
  console.log(`Total bounties on contract: ${all.length}`);
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
