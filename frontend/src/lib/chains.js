import { defineChain } from 'viem';

export const GEN_CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || '';
export const ARC_CONTRACT = import.meta.env.VITE_ARC_CONTRACT_ADDRESS || '';

// Arc testnet: USDC is the native gas token (18 decimals), same precision as GEN.
export const arcChain = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
});

// One place that describes each chain's role, currency, explorer, and which
// actions its contract supports. The UI reads this to stay chain-agnostic.
export const CHAINS = {
  genlayer: {
    key: 'genlayer',
    label: 'GenLayer',
    symbol: 'GEN',
    role: 'AI jury · judgment layer',
    contract: GEN_CONTRACT,
    explorer: 'https://explorer-studio.genlayer.com',
    explorerAddr: (a) => `https://explorer-studio.genlayer.com/address/${a}`,
    verdictSource: 'decided by validator consensus',
    cap: { canRunJury: true, hasAppeal: true, hasCancel: true, hasReputation: true, hasFinalize: true },
  },
  arc: {
    key: 'arc',
    label: 'Arc',
    symbol: 'USDC',
    role: 'USDC settlement layer',
    contract: ARC_CONTRACT,
    explorer: 'https://testnet.arcscan.app',
    explorerAddr: (a) => `https://testnet.arcscan.app/address/${a}`,
    verdictSource: 'relayed from the GenLayer jury, settled in USDC',
    cap: { canRunJury: false, hasAppeal: false, hasCancel: false, hasReputation: false, hasFinalize: false },
  },
};

const BOUNTY_TUPLE = {
  name: 'b',
  type: 'tuple',
  components: [
    { name: 'client', type: 'address' },
    { name: 'worker', type: 'address' },
    { name: 'reward', type: 'uint128' },
    { name: 'stake', type: 'uint128' },
    { name: 'status', type: 'uint8' },
    { name: 'verdict', type: 'uint8' },
    { name: 'confidence', type: 'uint8' },
    { name: 'specMatch', type: 'uint8' },
    { name: 'title', type: 'string' },
    { name: 'spec', type: 'string' },
    { name: 'deliverableUrl', type: 'string' },
    { name: 'reason', type: 'string' },
  ],
};

export const ARC_ABI = [
  { type: 'function', name: 'bountyCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'minConfidence', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'minSpecMatch', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'creditOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getBounty', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [BOUNTY_TUPLE] },
  { type: 'function', name: 'postBounty', stateMutability: 'payable', inputs: [{ type: 'string' }, { type: 'string' }, { type: 'uint128' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'claim', stateMutability: 'payable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'submit', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'string' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];
