#!/usr/bin/env node
/**
 * seed_phase3_10cases.js
 * Generates 10 new test cases across 5 wallets on GenLayer Studio Next.
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
  if (!k) throw new Error(`Missing env var ${name}`);
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

const CONTRACT = '0xF50d94C96dbE81e3b15Eb8fd0e4De24F1690b3f6';
const GEN = (n) => BigInt(Math.floor(n * 1e18));

let step = 0;

async function send(client, fn, args, value = 0n, label) {
  step++;
  const tag = `[Step ${step}] ${label}`;
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
  console.log('====================================================');
  console.log('  🚀 Seeding 10 Additional Test Cases (Wallets 1-5)');
  console.log('====================================================');
  console.log('Wallet 1:', w1.address);
  console.log('Wallet 2:', w2.address);
  console.log('Wallet 3:', w3.address);
  console.log('Wallet 4:', w4.address);
  console.log('Wallet 5:', w5.address);
  console.log('====================================================\n');

  // Case 1: OPEN (#17) by Wallet 4
  console.log('--- Case 1: OPEN by Wallet 4 ---');
  await send(c4, 'create_bounty', [
    '🛡️ Formal verification model for Proof of Sweat escrow',
    'Design a formal verification specification (in TLA+ or Coq) verifying that no locked bounty reward can ever be released without a valid quorum verdict and that stake slashing is mathematically sound.',
    'Include machine-checkable invariants and state transition bounds.',
    GEN(1.0)
  ], GEN(4.5), 'Create Case 1');
  const id1 = await getNextId();
  console.log('→ ID:', id1, '(OPEN)\n');

  // Case 2: OPEN (#18) by Wallet 5
  console.log('--- Case 2: OPEN by Wallet 5 ---');
  await send(c5, 'create_bounty', [
    '📈 Algorithmic dynamic stake pricing research',
    'Research paper on algorithmic dynamic stake sizing: adjust worker collateral based on historical trust score, historical slashing rate, and bounty reward size to minimize worker friction while preventing Sybil attacks.',
    'Mathematical proof of Nash equilibrium for rational workers and clients.',
    GEN(1.5)
  ], GEN(6.0), 'Create Case 2');
  const id2 = await getNextId();
  console.log('→ ID:', id2, '(OPEN)\n');

  // Case 3: CLAIMED (#19) Client 4, Worker 5
  console.log('--- Case 3: CLAIMED by Wallet 5 (posted by Wallet 4) ---');
  await send(c4, 'create_bounty', [
    '⚡ High-throughput WebSocket event indexer for GenLayer',
    'Build a high-performance event listener that subscribes to GenLayer block activation and indexes all Proof of Sweat contract events into PostgreSQL with GraphQL API.',
    'Dockerized with sub-second latency and reconnection backoff.',
    GEN(1.0)
  ], GEN(5.0), 'Create Case 3');
  const id3 = await getNextId();
  await send(c5, 'claim_bounty', [id3], GEN(1.0), 'Claim Case 3');
  console.log('→ ID:', id3, '(CLAIMED)\n');

  // Case 4: CLAIMED (#20) Client 5, Worker 3
  console.log('--- Case 4: CLAIMED by Wallet 3 (posted by Wallet 5) ---');
  await send(c5, 'create_bounty', [
    '🧩 Rust SDK bindings for Intelligent Contract execution',
    'Implement an ergonomic Rust crate wrapping GenLayer JSON-RPC endpoints with typesafe transaction builder, fee estimation, and decoders.',
    'Pass cargo clippy and include integration test fixtures.',
    GEN(2.0)
  ], GEN(7.5), 'Create Case 4');
  const id4 = await getNextId();
  await send(c3, 'claim_bounty', [id4], GEN(2.0), 'Claim Case 4');
  console.log('→ ID:', id4, '(CLAIMED)\n');

  // Case 5: SUBMITTED (#21) Client 1, Worker 4
  console.log('--- Case 5: SUBMITTED by Wallet 4 (posted by Wallet 1) ---');
  await send(c1, 'create_bounty', [
    '🌐 Cross-chain relayer architecture for Arbitrum & Optimism',
    'Architectural blueprint and reference smart contracts for relaying GenLayer AI verdicts to Arbitrum One and OP Mainnet using LayerZero v2 or Chainlink CCIP.',
    'Production ready solidity contracts + hardhat test deployment script.',
    GEN(0.8)
  ], GEN(3.5), 'Create Case 5');
  const id5 = await getNextId();
  await send(c4, 'claim_bounty', [id5], GEN(0.8), 'Claim Case 5');
  await send(c4, 'submit_work', [id5, 'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/README.md'], 0n, 'Submit Case 5');
  console.log('→ ID:', id5, '(SUBMITTED)\n');

  // Case 6: SUBMITTED (#22) Client 4, Worker 5
  console.log('--- Case 6: SUBMITTED by Wallet 5 (posted by Wallet 4) ---');
  await send(c4, 'create_bounty', [
    '🎨 Interactive 3D visualization of validator consensus',
    'Create a Three.js / WebGL visualization depicting 5 GenLayer validators reviewing a prompt in parallel, showing consensus convergence.',
    'Responsive canvas, smooth 60fps, dark mode cyber aesthetic.',
    GEN(1.0)
  ], GEN(4.0), 'Create Case 6');
  const id6 = await getNextId();
  await send(c5, 'claim_bounty', [id6], GEN(1.0), 'Claim Case 6');
  await send(c5, 'submit_work', [id6, 'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/SUBMISSION.md'], 0n, 'Submit Case 6');
  console.log('→ ID:', id6, '(SUBMITTED)\n');

  // Case 7: APPROVED (#23) Client 5, Worker 4 -> Adjudicate -> GENUINE!
  console.log('--- Case 7: APPROVED for Wallet 4 (posted by Wallet 5) ---');
  await send(c5, 'create_bounty', [
    '📝 Architecture study: The subjective consensus paradigm in web3',
    'Write an original, in-depth technical analysis of Proof of Sweat by an infrastructure engineer. Must cover: the core subjective consensus mechanism over meaning, the game-theoretic escrow and slashing rules, the dual-chain Arc settlement integration in native USDC, and empirical performance metrics on GenLayer Studio Next.',
    'Must be original first-person engineering analysis. Provide raw markdown link.',
    GEN(0.6)
  ], GEN(3.0), 'Create Case 7');
  const id7 = await getNextId();
  await send(c4, 'claim_bounty', [id7], GEN(0.6), 'Claim Case 7');
  await send(c4, 'submit_work', [id7, 'https://raw.githubusercontent.com/phu1271997/proof-of-sweat/main/demo_deliverable.md'], 0n, 'Submit Case 7');
  console.log('🤖 Running AI Jury for Case 7 (Worker 4)...');
  await send(c5, 'adjudicate', [id7], 0n, 'Adjudicate Case 7');
  const b7 = JSON.parse(await read('get_bounty', [id7]));
  console.log('→ ID:', id7, 'Verdict:', b7.verdict, 'Status:', b7.status, '(APPROVED)\n');

  // Case 8: REJECTED (#24) Client 4, Worker 5 -> Adjudicate -> REJECTED
  console.log('--- Case 8: REJECTED for Wallet 5 (posted by Wallet 4) ---');
  await send(c4, 'create_bounty', [
    '🔍 Comprehensive benchmark of zkEVM provers in 2026',
    'Benchmarking report comparing execution speeds and hardware requirements for Polygon Plonky3 vs SP1 vs RISC Zero across arithmetic intensive circuits.',
    'Provide benchmark scripts and CSV reproducibility data.',
    GEN(0.5)
  ], GEN(2.5), 'Create Case 8');
  const id8 = await getNextId();
  await send(c5, 'claim_bounty', [id8], GEN(0.5), 'Claim Case 8');
  await send(c5, 'submit_work', [id8, 'https://docs.github.com/en/get-started/quickstart/hello-world'], 0n, 'Submit Case 8');
  console.log('🤖 Running AI Jury for Case 8...');
  await send(c4, 'adjudicate', [id8], 0n, 'Adjudicate Case 8');
  const b8 = JSON.parse(await read('get_bounty', [id8]));
  console.log('→ ID:', id8, 'Verdict:', b8.verdict, 'Status:', b8.status, '(REJECTED)\n');

  // Case 9: APPEALED (#25) Client 1, Worker 5 -> REJECTED -> APPEALED
  console.log('--- Case 9: APPEALED by Wallet 5 (posted by Wallet 1) ---');
  await send(c1, 'create_bounty', [
    '⚖️ Decentralized arbitration mechanisms comparison',
    'Compare Kleros dispute resolution courts against GenLayer AI jury. Discuss juror economic incentives, bribe susceptibility, and subjective vs objective claims.',
    'Rigorous comparative analysis with game theoretic payoff matrices.',
    GEN(0.5)
  ], GEN(2.0), 'Create Case 9');
  const id9 = await getNextId();
  await send(c5, 'claim_bounty', [id9], GEN(0.5), 'Claim Case 9');
  await send(c5, 'submit_work', [id9, 'https://docs.github.com/en'], 0n, 'Submit Case 9');
  console.log('🤖 Running AI Jury for Case 9...');
  await send(c1, 'adjudicate', [id9], 0n, 'Adjudicate Case 9');
  console.log('Worker 5 appealing Case 9...');
  await send(c5, 'appeal', [id9], GEN(0.5), 'Appeal Case 9');
  const b9 = JSON.parse(await read('get_bounty', [id9]));
  console.log('→ ID:', id9, 'Status:', b9.status, '(5=APPEALED)\n');

  // Case 10: CANCELLED (#26) by Wallet 4
  console.log('--- Case 10: CANCELLED by Wallet 4 ---');
  await send(c4, 'create_bounty', [
    '❌ [Cancelled] Deprecated Python 3.10 compatibility layer',
    'Build backwards compatibility shims for Python 3.10 GenVM runtimes (no longer required after v0.3.0 upgrade).',
    'No longer needed.',
    GEN(0.3)
  ], GEN(1.5), 'Create Case 10');
  const id10 = await getNextId();
  await send(c4, 'cancel_bounty', [id10], 0n, 'Cancel Case 10');
  console.log('→ ID:', id10, '(CANCELLED)\n');

  console.log('====================================================');
  console.log('  🎉 All 10 Test Cases Processed Successfully!');
  console.log('====================================================');

  const all = JSON.parse(await read('get_all_bounties'));
  console.log(`Total bounties on contract: ${all.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
