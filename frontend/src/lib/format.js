// GEN has 18 decimals. We keep on-chain amounts as wei (bigint / decimal string)
// and only convert for display and input.

const DECIMALS = 18n;
const ONE = 10n ** DECIMALS;

/** Parse a human GEN amount ("1.5") into a wei bigint. */
export function parseGen(input) {
  const s = String(input).trim();
  if (s === '' || isNaN(Number(s))) return 0n;
  const neg = s.startsWith('-');
  const clean = neg ? s.slice(1) : s;
  const [whole, frac = ''] = clean.split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  const wei = BigInt(whole || '0') * ONE + BigInt(fracPadded || '0');
  return neg ? -wei : wei;
}

/** Format a wei amount (bigint | string) into a trimmed GEN string. */
export function formatGen(wei, maxFrac = 4) {
  let v;
  try {
    v = BigInt(wei ?? 0);
  } catch {
    return '0';
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / ONE;
  const frac = v % ONE;
  let fracStr = frac.toString().padStart(18, '0').slice(0, maxFrac).replace(/0+$/, '');
  const out = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${out}` : out;
}

export function shortAddr(addr) {
  if (!addr) return '·';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function sameAddr(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

// ── bounty status ────────────────────────────────────────────────────────────
export const STATUS = {
  0: { key: 'OPEN', label: 'Open', tone: 'cyan' },
  1: { key: 'CLAIMED', label: 'In progress', tone: 'blue' },
  2: { key: 'SUBMITTED', label: 'Awaiting jury', tone: 'amber' },
  3: { key: 'APPROVED', label: 'Approved · paid', tone: 'lime' },
  4: { key: 'REJECTED', label: 'Rejected', tone: 'red' },
  5: { key: 'APPEALED', label: 'Under appeal', tone: 'violet' },
  6: { key: 'RESOLVED_FRAUD', label: 'Fraud upheld', tone: 'red' },
  7: { key: 'CANCELLED', label: 'Cancelled', tone: 'muted' },
};

export const VERDICT = {
  GENUINE: { label: 'Genuine work', tone: 'lime' },
  AI_GENERATED: { label: 'AI-generated', tone: 'red' },
  PLAGIARIZED: { label: 'Plagiarized', tone: 'red' },
  UNCLEAR: { label: 'Unclear', tone: 'amber' },
};

export const EXPLORER = 'https://explorer-studio.genlayer.com';
