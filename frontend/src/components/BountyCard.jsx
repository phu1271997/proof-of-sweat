import React from 'react';
import { Badge } from './ui.jsx';
import { STATUS, VERDICT, formatGen, shortAddr, sameAddr } from '../lib/format.js';

export default function BountyCard({ b, account, onOpen }) {
  const st = STATUS[b.status] || STATUS[0];
  const vd = b.verdict ? VERDICT[b.verdict] : null;
  const mine = sameAddr(b.client, account);
  const working = sameAddr(b.worker, account);

  return (
    <button className="card" onClick={() => onOpen(b)}>
      <div className="card-top">
        <Badge tone={st.tone}>{st.label}</Badge>
        {mine && <span className="tag-you">you posted</span>}
        {working && <span className="tag-you tag-work">you claimed</span>}
      </div>
      <h3 className="card-title">{b.title || `Bounty #${b.id}`}</h3>
      <p className="card-spec">{b.spec}</p>

      {vd && (
        <div className={`verdict-strip tone-${vd.tone}`}>
          <span className="verdict-label">{vd.label}</span>
          <span className="mono verdict-conf">{b.confidence}% conf</span>
        </div>
      )}

      <div className="card-foot">
        <div className="stat">
          <span className="stat-num">{formatGen(b.reward)}</span>
          <span className="stat-unit">GEN reward</span>
        </div>
        <div className="stat">
          <span className="stat-num">{formatGen(b.stake_required)}</span>
          <span className="stat-unit">GEN stake</span>
        </div>
        <div className="stat right">
          <span className="stat-unit">#{b.id}</span>
          <span className="mono stat-worker">{b.worker ? shortAddr(b.worker) : 'unclaimed'}</span>
        </div>
      </div>
    </button>
  );
}
