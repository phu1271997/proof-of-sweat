import React, { useMemo, useState } from 'react';
import { Badge, Meter, Empty, Spinner } from './ui.jsx';
import { STATUS, VERDICT, formatGen, shortAddr } from '../lib/format.js';

// A case is "resolved" once the jury has settled it: approved & paid, rejected,
// or fraud upheld after an appeal.
const RESOLVED = new Set([3, 4, 6]);

function big(x) {
  try { return BigInt(x); } catch { return 0n; }
}

export default function Explorer({ bounties, loading, adapter, onOpen }) {
  const [filter, setFilter] = useState('all');
  const sym = adapter.symbol;

  const resolved = useMemo(
    () => bounties.filter((b) => RESOLVED.has(b.status)),
    [bounties],
  );

  const summary = useMemo(() => {
    let paidOut = 0n, paid = 0, rejected = 0, genuine = 0, fraud = 0;
    for (const b of resolved) {
      if (b.status === 3) { paid += 1; paidOut += big(b.reward) + big(b.stake_required); }
      else { rejected += 1; }
      if (b.verdict === 'GENUINE') genuine += 1;
      else if (b.verdict === 'AI_GENERATED' || b.verdict === 'PLAGIARIZED') fraud += 1;
    }
    return { count: resolved.length, paidOut: formatGen(paidOut), paid, rejected, genuine, fraud };
  }, [resolved]);

  const shown = useMemo(() => {
    if (filter === 'paid') return resolved.filter((b) => b.status === 3);
    if (filter === 'rejected') return resolved.filter((b) => b.status !== 3);
    return resolved;
  }, [resolved, filter]);

  const stats = [
    [summary.count, 'cases resolved'],
    [`${summary.paidOut} ${sym}`, 'paid to workers'],
    [summary.genuine, 'genuine'],
    [summary.fraud, 'fraud caught'],
  ];

  return (
    <section className="explorer">
      <div className="page-head">
        <div>
          <h1 className="page-title">Explorer</h1>
          <p className="page-sub">
            Every case the AI jury has settled on-chain: the verdict, the confidence, and who was paid.
            Nothing here is entered by hand; each row is read straight from the contract.
          </p>
        </div>
      </div>

      <div className="xp-summary">
        {stats.map(([n, l]) => (
          <div key={l} className="xp-sum">
            <span className="xp-sum-n mono">{n}</span>
            <span className="xp-sum-l">{l}</span>
          </div>
        ))}
        {adapter.configured() && (
          <a className="xp-verify mono" href={adapter.explorerAddr(adapter.contract)} target="_blank" rel="noreferrer">
            verify on {adapter.label} explorer ↗
          </a>
        )}
      </div>

      <div className="xp-filters" role="tablist">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>All {summary.count}</Chip>
        <Chip on={filter === 'paid'} onClick={() => setFilter('paid')}>Paid {summary.paid}</Chip>
        <Chip on={filter === 'rejected'} onClick={() => setFilter('rejected')}>Rejected {summary.rejected}</Chip>
      </div>

      {loading ? (
        <div className="loading-wrap"><Spinner size={28} /><span>Loading resolved cases</span></div>
      ) : shown.length === 0 ? (
        <Empty title="No resolved cases yet">
          Once a bounty is submitted and the AI jury settles it, the decision shows up here for anyone to inspect.
        </Empty>
      ) : (
        <div className="xp-list">
          {shown.map((b) => <CaseRow key={b.id} b={b} sym={sym} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}

function CaseRow({ b, sym, onOpen }) {
  const v = VERDICT[b.verdict] || { label: b.verdict || 'Unresolved', tone: 'muted' };
  const st = STATUS[b.status] || STATUS[0];
  const paid = b.status === 3;
  const payout = formatGen(big(b.reward) + big(b.stake_required));
  return (
    <button className={`case-row tone-${v.tone}`} onClick={() => onOpen(b)}>
      <div className="case-main">
        <div className="case-head">
          <span className="case-id mono">#{b.id}</span>
          <h3 className="case-title">{b.title || `Bounty #${b.id}`}</h3>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        {b.reason && <p className="case-reason">{clip(b.reason, 240)}</p>}
        <div className="case-pay">
          {paid
            ? <span className="pay-out">{payout} {sym} paid to {shortAddr(b.worker)}</span>
            : <span className="pay-held">{formatGen(b.reward)} {sym} reward withheld</span>}
        </div>
      </div>
      <div className="case-side">
        <span className={`case-verdict tone-${v.tone}`}>{v.label}</span>
        <div className="case-meters">
          <Meter label="Confidence" value={Number(b.confidence) || 0} tone={v.tone} />
          <Meter label="Spec match" value={Number(b.spec_match) || 0} tone="cyan" />
        </div>
      </div>
    </button>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button className={`xp-chip ${on ? 'is-on' : ''}`} onClick={onClick} role="tab" aria-selected={on}>
      {children}
    </button>
  );
}

function clip(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}
