#!/usr/bin/env node
/**
 * seed_bounties.js — Populate the Proof of Sweat contract with 15 diverse bounties
 * across all lifecycle stages for a compelling hackathon demo.
 *
 * Uses 3 wallets:
 *   Account 1 (GENLAYER_PRIVATE_KEY)   → "Client A" — posts bounties, cancels, finalizes
 *   Account 2 (GENLAYER_PRIVATE_KEY_2) → "Worker B" — claims, submits, appeals
 *   Account 3 (GENLAYER_PRIVATE_KEY_3) → "Client C / Worker C" — posts some bounties, claims others
 *
 * Usage:
 *   source ~/.genlayer/env.sh
 *   node scripts/deploy/seed_bounties.js
 */

const path = require('path');
const { createClient, createAccount } = require(
  path.resolve(__dirname, '../../frontend/node_modules/genlayer-js')
);
const { studioDevnet } = require(
  path.resolve(__dirname, '../../frontend/node_modules/genlayer-js/dist/chains/index.cjs')
);

// ── Studio Next chain config ──────────────────────────────────────────────
const studioNext = {
  ...studioDevnet,
  id: 61997,
  name: 'GenLayer Studio Next',
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
};

// ── Accounts ──────────────────────────────────────────────────────────────
function loadKey(envVar) {
  let k = process.env[envVar] || '';
  if (!k) { console.error(`Missing ${envVar}`); process.exit(1); }
  if (!k.startsWith('0x')) k = '0x' + k;
  return k;
}

const acct1 = createAccount(loadKey('GENLAYER_PRIVATE_KEY'));
const acct2 = createAccount(loadKey('GENLAYER_PRIVATE_KEY_2'));
const acct3 = createAccount(loadKey('GENLAYER_PRIVATE_KEY_3'));

const client1 = createClient({ chain: studioNext, account: acct1 });
const client2 = createClient({ chain: studioNext, account: acct2 });
const client3 = createClient({ chain: studioNext, account: acct3 });

const CONTRACT = '0xF50d94C96dbE81e3b15Eb8fd0e4De24F1690b3f6';

// ── Helpers ───────────────────────────────────────────────────────────────
const GEN = (n) => BigInt(Math.floor(n * 1e18));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let txCount = 0;

async function sendWrite(client, fn, args, value = 0n, label = '') {
  txCount++;
  const tag = `[TX#${txCount}] ${label || fn}`;
  console.log(`${tag} — submitting...`);
  const fees = await client.estimateTransactionFees({});
  const opts = { address: CONTRACT, functionName: fn, args, fees };
  if (value > 0n) opts.value = value;
  const hash = await client.writeContract(opts);
  console.log(`${tag} — hash: ${hash.slice(0, 18)}… waiting…`);
  const rcpt = await client.waitForTransactionReceipt({
    hash, waitUntil: 'decided', interval: 2500, retries: 80,
  });
  const ok = rcpt.txExecutionResultName === 'FINISHED_WITH_RETURN';
  console.log(`${tag} — ${ok ? '✅' : '❌'} ${rcpt.txExecutionResultName}`);
  if (!ok) {
    console.warn(`  ⚠ TX failed: ${hash}`);
  }
  return { hash, ok, rcpt };
}

async function readView(fn, args = []) {
  return client1.readContract({ address: CONTRACT, functionName: fn, args });
}

// ── Bounty definitions ────────────────────────────────────────────────────
// 15 bounties covering all statuses for a rich demo
const BOUNTIES = [
  // ════════════════════════════════════════════════════════════════════════
  // GROUP A: OPEN bounties (status 0) — freshly posted, waiting for workers
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'A1', target: 'OPEN', client: 1,
    title: '🎯 Write a GenLayer vs Optimistic Rollups comparison article',
    spec: 'Write a 1500-word technical deep-dive comparing GenLayer subjective consensus with Optimistic Rollups (Optimism, Arbitrum). Cover: validator architecture, dispute resolution, finality time, and use-cases where GenLayer excels. Must include diagrams.',
    rules: 'Original writing only. Cite primary sources. No AI-generated filler.',
    reward: GEN(2), stake: GEN(0.5),
  },
  {
    id: 'A2', target: 'OPEN', client: 3,
    title: '🎨 Design a Proof of Sweat logo and brand kit',
    spec: 'Create a professional logo for "Proof of Sweat" bounty platform. Deliverables: SVG logo (primary + monochrome), color palette, typography guide, and 3 social media templates (Twitter header, Discord avatar, GitHub social preview).',
    rules: 'Must be original work. No stock illustrations or AI-generated art. Provide source files (Figma/Sketch).',
    reward: GEN(5), stake: GEN(1),
  },
  {
    id: 'A3', target: 'OPEN', client: 1,
    title: '📊 Build a GenLayer ecosystem analytics dashboard',
    spec: 'Build a web dashboard that tracks GenLayer ecosystem metrics: total contracts deployed, daily transactions, active validators, gas usage trends. Use the GenLayer RPC/Explorer API. Deploy on Vercel/Netlify.',
    rules: 'Clean code with README. Must be publicly accessible. Real-time data preferred.',
    reward: GEN(8), stake: GEN(2),
  },
  {
    id: 'A4', target: 'OPEN', client: 3,
    title: '🔐 Security audit report for an Intelligent Contract',
    spec: 'Perform a security review of a GenLayer Intelligent Contract (provided upon claiming). Identify vulnerabilities in: storage access patterns, reentrancy risks, validator consensus manipulation, prompt injection in AI jury logic. Deliver a structured PDF report.',
    rules: 'Professional format. Must include severity ratings (Critical/High/Medium/Low). Reference GenLayer docs.',
    reward: GEN(10), stake: GEN(3),
  },

  // ════════════════════════════════════════════════════════════════════════
  // GROUP B: CLAIMED bounties (status 1) — worker locked in, working on it
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'B1', target: 'CLAIMED', client: 1, worker: 2,
    title: '📝 Write a "Getting Started with GenLayer" tutorial',
    spec: 'Create a beginner-friendly tutorial (blog post + GitHub repo) that walks a developer through: installing GenLayer tools, writing their first Intelligent Contract, deploying to Studio, and calling it from a React frontend. Target audience: Solidity devs curious about GenLayer.',
    rules: 'Must be tested end-to-end. Include screenshots. Code must compile and run.',
    reward: GEN(3), stake: GEN(0.5),
  },
  {
    id: 'B2', target: 'CLAIMED', client: 3, worker: 2,
    title: '🤖 Build a GenLayer Discord bot for contract interaction',
    spec: 'Build a Discord bot that lets users interact with GenLayer contracts from Discord: /deploy to deploy a contract, /call to call a view function, /tx to send a write transaction. Use discord.js and genlayer-js SDK.',
    rules: 'Clean TypeScript code. Include unit tests. Bot must be deployable to Railway/Fly.io.',
    reward: GEN(4), stake: GEN(1),
  },

  // ════════════════════════════════════════════════════════════════════════
  // GROUP C: SUBMITTED bounties (status 2) — work done, awaiting AI jury
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'C1', target: 'SUBMITTED', client: 1, worker: 2,
    title: '🧪 Comprehensive test suite for GenLayer boilerplate',
    spec: 'Write a comprehensive pytest test suite for the GenLayer project boilerplate (football_bets.py). Cover: bet creation edge cases, resolution with mocked LLM responses, error handling, view function outputs. Minimum 15 test cases.',
    rules: 'Use genlayer-test direct mode. All tests must pass. Include CI config (GitHub Actions).',
    reward: GEN(2.5), stake: GEN(0.5),
    deliverable: 'https://github.com/nickg/vhdl-mode/blob/master/README.md',
  },
  {
    id: 'C2', target: 'SUBMITTED', client: 3, worker: 2,
    title: '📱 Mobile-responsive redesign of a GenLayer dApp',
    spec: 'Take the Proof of Sweat frontend and create a fully mobile-responsive version. Must work on iPhone SE through iPad Pro. Implement: bottom navigation, swipeable bounty cards, pull-to-refresh, and haptic feedback on interactions.',
    rules: 'Use Tailwind CSS. Test on real devices (provide screenshots). No layout breakage on any viewport.',
    reward: GEN(3.5), stake: GEN(0.75),
    deliverable: 'https://tailwindcss.com/docs/responsive-design',
  },

  // ════════════════════════════════════════════════════════════════════════
  // GROUP D: Will be ADJUDICATED (→ APPROVED or REJECTED by AI jury)
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'D1', target: 'ADJUDICATE', client: 1, worker: 3,
    title: '✍️ Personal essay: "Why I believe in subjective consensus"',
    spec: 'Write a 1000-word personal essay reflecting on why subjective consensus matters for the future of web3. Share your genuine perspective — what excited you, what concerns you, what you would build with it.',
    rules: 'Must be authentic first-person writing with specific personal insights. No generic web3 platitudes.',
    reward: GEN(1.5), stake: GEN(0.3),
    deliverable: 'https://vitalik.eth.limo/general/2024/01/31/ai.html',
  },
  {
    id: 'D2', target: 'ADJUDICATE', client: 1, worker: 3,
    title: '🔍 Research: Zero-knowledge proofs in validator networks',
    spec: 'Write a technical analysis of how zero-knowledge proofs could enhance GenLayer validator networks. Cover: privacy-preserving consensus, ZK-SNARKs for verdict verification, performance trade-offs. Include concrete examples and pseudocode.',
    rules: 'Must demonstrate understanding of both ZK proofs and GenLayer architecture. Cite academic papers.',
    reward: GEN(3), stake: GEN(0.5),
    deliverable: 'https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/',
  },
  {
    id: 'D3', target: 'ADJUDICATE', client: 3, worker: 2,
    title: '📋 GenLayer developer onboarding checklist & FAQ',
    spec: 'Create a comprehensive developer onboarding document for GenLayer. Include: environment setup (macOS/Linux/Windows), common pitfalls, FAQ with 20+ real questions, troubleshooting flowchart, and links to all official resources.',
    rules: 'Must be accurate and tested. Include version numbers. Structured in Markdown with a table of contents.',
    reward: GEN(2), stake: GEN(0.4),
    deliverable: 'https://docs.github.com/en/get-started/quickstart/hello-world',
  },

  // ════════════════════════════════════════════════════════════════════════
  // GROUP E: CANCELLED bounties (status 7) — client withdrew the bounty
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'E1', target: 'CANCELLED', client: 1,
    title: '❌ [Cancelled] Video walkthrough of GenLayer Studio',
    spec: 'Record a 10-minute screen recording walking through GenLayer Studio: creating a contract, deploying, interacting, viewing on explorer. Narrated in English with captions.',
    rules: 'HD quality (1080p min). Clear audio. Upload to YouTube as unlisted.',
    reward: GEN(1), stake: GEN(0.2),
  },
  {
    id: 'E2', target: 'CANCELLED', client: 3,
    title: '❌ [Cancelled] Translate GenLayer docs to Vietnamese',
    spec: 'Translate the core GenLayer developer documentation (Getting Started, Intelligent Contracts, Consensus) to Vietnamese. Maintain technical accuracy and natural language flow.',
    rules: 'Native-level Vietnamese. Technical terms may remain in English with Vietnamese explanation in parentheses.',
    reward: GEN(2), stake: GEN(0.5),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🌱  Proof of Sweat — Seed 15 Demo Bounties');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Contract : ${CONTRACT}`);
  console.log(`  Account 1: ${acct1.address} (Client A)`);
  console.log(`  Account 2: ${acct2.address} (Worker B)`);
  console.log(`  Account 3: ${acct3.address} (Client C / Worker C)`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // Check existing bounties (skip the genesis bounty we already created)
  const existing = JSON.parse(await readView('get_all_bounties'));
  console.log(`📦 Existing bounties on contract: ${existing.length}`);
  console.log('');

  const clientMap = { 1: client1, 2: client2, 3: client3 };
  const results = [];

  for (let i = 0; i < BOUNTIES.length; i++) {
    const b = BOUNTIES[i];
    console.log(`\n━━━ Bounty ${i + 1}/15 [${b.id}] target=${b.target} ━━━`);
    console.log(`    "${b.title.slice(0, 60)}…"`);

    const clientCl = clientMap[b.client];

    // Step 1: CREATE
    const { ok: created } = await sendWrite(
      clientCl, 'create_bounty',
      [b.title, b.spec, b.rules || '', b.stake],
      b.reward,
      `${b.id} create_bounty`
    );
    if (!created) { results.push({ id: b.id, status: 'FAILED_CREATE' }); continue; }

    // The bounty ID is the next sequential number
    const allBounties = JSON.parse(await readView('get_all_bounties'));
    const bountyId = String(allBounties.length - 1);
    console.log(`    → Bounty ID on-chain: ${bountyId}`);

    // Step 2: Target-specific transitions
    if (b.target === 'OPEN') {
      results.push({ id: b.id, bountyId, status: 'OPEN' });
      continue;
    }

    if (b.target === 'CANCELLED') {
      await sendWrite(clientCl, 'cancel_bounty', [bountyId], 0n, `${b.id} cancel`);
      results.push({ id: b.id, bountyId, status: 'CANCELLED' });
      continue;
    }

    // Need a worker to claim
    const workerCl = clientMap[b.worker];
    const { ok: claimed } = await sendWrite(
      workerCl, 'claim_bounty', [bountyId], b.stake, `${b.id} claim`
    );
    if (!claimed) { results.push({ id: b.id, bountyId, status: 'FAILED_CLAIM' }); continue; }

    if (b.target === 'CLAIMED') {
      results.push({ id: b.id, bountyId, status: 'CLAIMED' });
      continue;
    }

    // Submit work
    const url = b.deliverable || 'https://example.com/deliverable';
    const { ok: submitted } = await sendWrite(
      workerCl, 'submit_work', [bountyId, url], 0n, `${b.id} submit`
    );
    if (!submitted) { results.push({ id: b.id, bountyId, status: 'FAILED_SUBMIT' }); continue; }

    if (b.target === 'SUBMITTED') {
      results.push({ id: b.id, bountyId, status: 'SUBMITTED' });
      continue;
    }

    // ADJUDICATE — run the AI jury (this is the slow part)
    if (b.target === 'ADJUDICATE') {
      console.log(`    🤖 Running AI jury (this takes 30-90s)…`);
      const { ok: adjOk } = await sendWrite(
        clientCl, 'adjudicate', [bountyId], 0n, `${b.id} adjudicate`
      );

      // Read the resulting status
      const bountyData = JSON.parse(await readView('get_bounty', [bountyId]));
      const statusName = ['OPEN','CLAIMED','SUBMITTED','APPROVED','REJECTED','APPEALED','RESOLVED_FRAUD','CANCELLED'][bountyData.status];
      console.log(`    🏷  Verdict: ${bountyData.verdict} (conf=${bountyData.confidence}%, spec=${bountyData.spec_match}%)`);
      console.log(`    📊 Status after adjudication: ${statusName}`);
      results.push({
        id: b.id, bountyId, status: statusName,
        verdict: bountyData.verdict,
        confidence: bountyData.confidence,
      });
      continue;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📊  SEED RESULTS SUMMARY');
  console.log('══════════════════════════════════════════════════════════');

  const statusCounts = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    const extra = r.verdict ? ` (${r.verdict}, ${r.confidence}%)` : '';
    console.log(`  ${r.id.padEnd(4)} bounty#${(r.bountyId||'?').padEnd(3)} → ${r.status}${extra}`);
  }
  console.log('──────────────────────────────────────────────────────────');
  for (const [s, c] of Object.entries(statusCounts).sort()) {
    console.log(`  ${s.padEnd(20)} : ${c}`);
  }

  const finalBounties = JSON.parse(await readView('get_all_bounties'));
  console.log(`\n  Total bounties on contract: ${finalBounties.length}`);
  console.log(`  Total transactions sent:    ${txCount}`);
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n🌐 View live: https://proofofsweat-app.vercel.app`);
  console.log(`🔗 Explorer:  https://explorer-studio-dev.genlayer.com/address/${CONTRACT}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
