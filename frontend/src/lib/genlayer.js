import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || '';

export function contractConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT);
}

// Read-only client (no signer needed for views / balances).
let _readClient;
function readClient() {
  if (!_readClient) _readClient = createClient({ chain: studionet });
  return _readClient;
}

// Write client bound to the connected MetaMask account (MetaMask signs).
function writeClient(account) {
  return createClient({
    chain: studionet,
    account,
    provider: typeof window !== 'undefined' ? window.ethereum : undefined,
  });
}

async function read(functionName, args = []) {
  return readClient().readContract({ address: CONTRACT, functionName, args });
}

function parse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// ── views ────────────────────────────────────────────────────────────────────
export async function fetchBounties() {
  const raw = await read('get_all_bounties', []);
  const list = typeof raw === 'string' ? parse(raw, []) : raw || [];
  // newest first
  return [...list].sort((a, b) => Number(b.id) - Number(a.id));
}

export async function fetchBounty(id) {
  const raw = await read('get_bounty', [String(id)]);
  return typeof raw === 'string' ? parse(raw, null) : raw;
}

export async function fetchReputation(address) {
  const raw = await read('get_reputation', [address]);
  return typeof raw === 'string' ? parse(raw, null) : raw;
}

export async function fetchCredit(address) {
  const raw = await read('get_credit', [address]);
  return typeof raw === 'string' ? raw : String(raw ?? '0');
}

export async function fetchConfig() {
  const raw = await read('get_config', []);
  return typeof raw === 'string' ? parse(raw, {}) : raw;
}

export async function fetchNativeBalance(address) {
  try {
    return await readClient().getBalance({ address });
  } catch {
    return 0n;
  }
}

// ── writes ───────────────────────────────────────────────────────────────────
/**
 * Send a state-changing tx through MetaMask and wait until validators accept it.
 * Returns { hash, receipt }.
 */
export async function send(account, functionName, args = [], value = 0n, onStatus) {
  const client = writeClient(account);
  onStatus?.('Awaiting signature in MetaMask…');
  const hash = await client.writeContract({ address: CONTRACT, functionName, args, value });
  onStatus?.('Submitted. Validators reaching consensus…');
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: 'ACCEPTED',
    interval: 3000,
    retries: 120,
  });
  return { hash, receipt };
}
