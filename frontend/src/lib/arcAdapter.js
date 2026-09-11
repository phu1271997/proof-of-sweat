import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { arcChain, ARC_ABI, ARC_CONTRACT } from './chains.js';

const CONTRACT = ARC_CONTRACT;
const ZERO = '0x0000000000000000000000000000000000000000';
const VERDICTS = ['', 'GENUINE', 'AI_GENERATED', 'PLAGIARIZED', 'UNCLEAR'];

let _pub;
function pub() {
  if (!_pub) _pub = createPublicClient({ chain: arcChain, transport: http() });
  return _pub;
}

export function arcConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT);
}

function mapBounty(b, id) {
  return {
    id: String(id),
    title: b.title,
    spec: b.spec,
    rules: '',
    client: b.client,
    worker: b.worker === ZERO ? '' : b.worker,
    reward: b.reward.toString(),
    stake_required: b.stake.toString(),
    status: Number(b.status),
    verdict: VERDICTS[Number(b.verdict)] || '',
    confidence: Number(b.confidence),
    spec_match: Number(b.specMatch),
    reason: b.reason,
    deliverable_url: b.deliverableUrl,
  };
}

async function readC(functionName, args = []) {
  return pub().readContract({ address: CONTRACT, abi: ARC_ABI, functionName, args });
}

export async function arcListBounties() {
  if (!arcConfigured()) return [];
  const n = Number(await readC('bountyCount'));
  const rows = await Promise.all(
    [...Array(n).keys()].map((i) =>
      readC('getBounty', [BigInt(i)]).then((b) => mapBounty(b, i)).catch(() => null),
    ),
  );
  return rows.filter(Boolean).sort((a, b) => Number(b.id) - Number(a.id));
}

export async function arcGetBounty(id) {
  const b = await readC('getBounty', [BigInt(id)]);
  return mapBounty(b, id);
}

export async function arcGetConfig() {
  if (!arcConfigured()) return {};
  const [n, c, s] = await Promise.all([readC('bountyCount'), readC('minConfidence'), readC('minSpecMatch')]);
  return { total_bounties: Number(n), confidence_threshold: Number(c), min_spec_match: Number(s) };
}

export async function arcGetCredit(address) {
  try { return (await readC('creditOf', [address])).toString(); } catch { return '0'; }
}

export async function arcGetBalance(address) {
  try { return await pub().getBalance({ address }); } catch { return 0n; }
}

export async function arcFetchReputation() {
  return null; // reputation lives on the GenLayer judgment layer, not on Arc
}

// Maps the app's normalized action names to the ArcSettlement contract calls.
export async function arcSend(account, fn, args = [], value = 0n, onStatus) {
  const wallet = createWalletClient({ account, chain: arcChain, transport: custom(window.ethereum) });
  onStatus?.('Awaiting signature in MetaMask…');
  const base = { address: CONTRACT, abi: ARC_ABI, account, chain: arcChain };
  let hash;
  if (fn === 'create_bounty') {
    const [title, spec, rules, stake] = args;
    const fullSpec = rules && rules.trim() ? `${spec}\n\nRules: ${rules}` : spec;
    hash = await wallet.writeContract({ ...base, functionName: 'postBounty', args: [title, fullSpec, BigInt(stake)], value: BigInt(value) });
  } else if (fn === 'claim_bounty') {
    hash = await wallet.writeContract({ ...base, functionName: 'claim', args: [BigInt(args[0])], value: BigInt(value) });
  } else if (fn === 'submit_work') {
    hash = await wallet.writeContract({ ...base, functionName: 'submit', args: [BigInt(args[0]), args[1]] });
  } else if (fn === 'withdraw') {
    hash = await wallet.writeContract({ ...base, functionName: 'withdraw', args: [] });
  } else {
    throw new Error('On Arc, settlement is posted by the GenLayer relayer, not from the app.');
  }
  onStatus?.('Submitted. Waiting for finality…');
  const receipt = await pub().waitForTransactionReceipt({ hash });
  return { hash, receipt };
}
