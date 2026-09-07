import React, { useEffect, useState } from 'react';
import { Modal, Button, Badge, Meter, Field } from './ui.jsx';
import { STATUS, VERDICT, formatGen, shortAddr, sameAddr, EXPLORER } from '../lib/format.js';
import { send, fetchReputation, fetchBounty } from '../lib/genlayer.js';
import { friendly } from './CreateBounty.jsx';

export default function BountyModal({ bounty, account, onClose, onRefresh, notify }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [rep, setRep] = useState(null);
  const b = bounty;

  useEffect(() => {
    setUrl('');
    if (b?.worker) fetchReputation(b.worker).then(setRep).catch(() => setRep(null));
    else setRep(null);
  }, [b?.id, b?.worker, b?.status]);

  if (!b) return null;
  const st = STATUS[b.status] || STATUS[0];
  const vd = b.verdict ? VERDICT[b.verdict] : null;
  const isClient = sameAddr(b.client, account);
  const isWorker = sameAddr(b.worker, account);
  const canClaim = b.status === 0 && account && !isClient;

  async function act(fn, args, value, okMsg) {
    if (!account) return notify({ tone: 'error', msg: 'Connect your wallet first.' });
    setBusy(fn);
    try {
      const { hash } = await send(account, fn, args, value ?? 0n, (msg) =>
        notify({ tone: 'info', msg, busy: true }),
      );
      if (fn === 'adjudicate') {
        // Non-deterministic rounds can come back undetermined; the state won't
        // have advanced. Tell the user to re-run rather than claiming a verdict.
        const fresh = await fetchBounty(b.id);
        if (fresh && (fresh.status === 2 || fresh.status === 5)) {
          notify({ tone: 'info', msg: 'Validators were undetermined this round. Click “Run the AI jury” again.' });
        } else {
          notify({ tone: 'success', msg: fresh?.verdict ? `AI jury verdict: ${fresh.verdict}.` : okMsg, hash });
        }
      } else {
        notify({ tone: 'success', msg: okMsg, hash });
      }
      await onRefresh?.();
    } catch (err) {
      notify({ tone: 'error', msg: friendly(err) });
    } finally {
      setBusy('');
    }
  }

  const submitWork = () => {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) return notify({ tone: 'error', msg: 'Enter a valid http(s) URL.' });
    act('submit_work', [String(b.id), u], 0n, 'Work submitted for review.');
  };

  return (
    <Modal open onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <Badge tone={st.tone}>{st.label}</Badge>
          <span className="mono detail-id">Bounty #{b.id}</span>
        </div>
        <h2 className="detail-title">{b.title || `Bounty #${b.id}`}</h2>

        <div className="detail-stats">
          <div className="dstat"><span>{formatGen(b.reward)}</span><label>GEN reward</label></div>
          <div className="dstat"><span>{formatGen(b.stake_required)}</span><label>GEN stake</label></div>
          <div className="dstat"><span className="mono small">{shortAddr(b.client)}</span><label>client</label></div>
          <div className="dstat"><span className="mono small">{b.worker ? shortAddr(b.worker) : 'unclaimed'}</span><label>worker</label></div>
        </div>

        <section className="detail-block">
          <h4>Spec</h4>
          <p>{b.spec}</p>
        </section>
        {b.rules && (
          <section className="detail-block">
            <h4>Rules</h4>
            <p>{b.rules}</p>
          </section>
        )}
        {b.deliverable_url && (
          <section className="detail-block">
            <h4>Submitted deliverable</h4>
            <a className="deliverable" href={b.deliverable_url} target="_blank" rel="noreferrer">
              {b.deliverable_url} ↗
            </a>
          </section>
        )}

        {/* AI verdict panel: the GenLayer moment */}
        {vd && (
          <section className={`verdict-panel tone-${vd.tone}`}>
            <div className="verdict-panel-top">
              <span className="verdict-eyebrow">AI jury verdict · decided by validator consensus</span>
              <span className={`verdict-big tone-${vd.tone}`}>{vd.label}</span>
            </div>
            <div className="verdict-meters">
              <Meter label="Confidence" value={b.confidence} tone={vd.tone} />
              <Meter label="Spec match" value={b.spec_match} tone="cyan" />
            </div>
            {b.reason && <blockquote className="verdict-reason">“{b.reason}”</blockquote>}
            {b.appealed && <div className="appeal-note">This verdict was reached on appeal.</div>}
          </section>
        )}

        {rep && (rep.genuine > 0 || rep.fraud > 0) && (
          <section className="rep-row">
            <span className="rep-label">Worker reputation</span>
            <span className={`rep-score ${rep.trust_score >= 60 ? 'good' : 'bad'}`}>{rep.trust_score}% trust</span>
            <span className="rep-detail">{rep.genuine} genuine · {rep.fraud} fraud · {formatGen(rep.earned)} GEN earned</span>
          </section>
        )}

        {/* contextual actions */}
        <div className="detail-actions">
          {canClaim && (
            <Button busy={busy === 'claim_bounty'} onClick={() => act('claim_bounty', [String(b.id)], BigInt(b.stake_required), 'Bounty claimed. Get to work!')}>
              Claim & stake {formatGen(b.stake_required)} GEN
            </Button>
          )}
          {b.status === 0 && isClient && (
            <Button variant="ghost" busy={busy === 'cancel_bounty'} onClick={() => act('cancel_bounty', [String(b.id)], 0n, 'Bounty cancelled, reward refunded to your credit.')}>
              Cancel & refund
            </Button>
          )}

          {b.status === 1 && isWorker && (
            <div className="submit-row">
              <Field label="Deliverable URL" hint="Public link the jury can read: a gist, PR, article, portfolio page.">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Button busy={busy === 'submit_work'} onClick={submitWork}>Submit for review</Button>
            </div>
          )}
          {b.status === 1 && !isWorker && <Info>Worker is completing the task.</Info>}

          {(b.status === 2 || b.status === 5) && account && (
            <Button variant="jury" busy={busy === 'adjudicate'} onClick={() => act('adjudicate', [String(b.id)], 0n, 'The AI jury has ruled.')}>
              {b.status === 5 ? 'Re-run the AI jury (appeal)' : 'Run the AI jury'}
            </Button>
          )}
          {(b.status === 2 || b.status === 5) && !account && <Info>Connect a wallet to trigger the AI jury.</Info>}

          {b.status === 4 && isWorker && (
            <Button variant="violet" busy={busy === 'appeal'} onClick={() => act('appeal', [String(b.id)], BigInt(b.stake_required), 'Appeal filed. Re-run the jury.')}>
              Appeal · bond {formatGen(b.stake_required)} GEN
            </Button>
          )}
          {b.status === 4 && isClient && (
            <Button variant="ghost" busy={busy === 'finalize_rejection'} onClick={() => act('finalize_rejection', [String(b.id)], 0n, 'Rejection finalized. Escrow moved to your credit.')}>
              Finalize & claim escrow
            </Button>
          )}
          {b.status === 4 && !isWorker && !isClient && <Info>Awaiting the worker&rsquo;s appeal or the client finalizing.</Info>}

          {b.status === 3 && <Info tone="good">Approved. {isWorker ? 'Withdraw your GEN from the header.' : 'The worker has been paid.'}</Info>}
          {b.status === 6 && <Info tone="bad">Fraud upheld. The client was compensated from escrow.</Info>}
          {b.status === 7 && <Info>Cancelled by the client.</Info>}
        </div>

        <a className="explorer-link" href={`${EXPLORER}/address/${bountyContract()}`} target="_blank" rel="noreferrer">
          view contract on GenLayer Explorer ↗
        </a>
      </div>
    </Modal>
  );
}

function Info({ children, tone }) {
  return <div className={`info-line ${tone ? 'info-' + tone : ''}`}>{children}</div>;
}

function bountyContract() {
  return import.meta.env.VITE_CONTRACT_ADDRESS || '';
}
