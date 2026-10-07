import React, { useEffect, useState } from 'react';
import { Modal, Button, Badge, Meter, Field } from './ui.jsx';
import { STATUS, VERDICT, CROSS, formatGen, shortAddr, sameAddr } from '../lib/format.js';
import { friendly } from './CreateBounty.jsx';
import { useChain } from '../lib/chainContext.jsx';

export default function BountyModal({
  bounty,
  account,
  credit,
  onClose,
  onRefresh,
  onWithdraw,
  withdrawing,
  notify,
}) {
  const { adapter } = useChain();
  const cap = adapter.cap;
  const sym = adapter.symbol;
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [rep, setRep] = useState(null);
  const [userCredit, setUserCredit] = useState(credit || '0');
  const [loadingCredit, setLoadingCredit] = useState(true);
  const b = bounty;

  useEffect(() => {
    if (credit !== undefined && credit !== null) {
      setUserCredit(String(credit));
    }
  }, [credit]);

  useEffect(() => {
    let active = true;
    if (account && adapter?.getCredit) {
      setLoadingCredit(true);
      adapter.getCredit(account).then((c) => {
        if (active && c !== undefined && c !== null) setUserCredit(String(c));
      }).catch(() => {}).finally(() => {
        if (active) setLoadingCredit(false);
      });
    } else {
      setLoadingCredit(false);
    }
    return () => { active = false; };
  }, [account, adapter, b?.id, b?.status]);

  useEffect(() => {
    setUrl('');
    if (cap.hasReputation && b?.worker) adapter.fetchReputation(b.worker).then(setRep).catch(() => setRep(null));
    else setRep(null);
  }, [b?.id, b?.worker, b?.status, adapter, cap.hasReputation]);

  if (!b) return null;
  const st = STATUS[b.status] || STATUS[0];
  const vd = b.verdict ? VERDICT[b.verdict] : null;
  const isClient = sameAddr(b.client, account);
  const isWorker = sameAddr(b.worker, account);
  const canClaim = b.status === 0 && account && !isClient;

  async function handleWithdraw() {
    if (onWithdraw) {
      await onWithdraw();
      if (account && adapter?.getCredit) {
        adapter.getCredit(account).then((c) => {
          if (c !== undefined && c !== null) setUserCredit(String(c));
        }).catch(() => {});
      }
    } else {
      await act('withdraw', [], 0n, `Payout claimed to your wallet in ${sym}.`);
      if (account && adapter?.getCredit) {
        adapter.getCredit(account).then((c) => {
          if (c !== undefined && c !== null) setUserCredit(String(c));
        }).catch(() => {});
      }
    }
  }

  async function act(fn, args, value, okMsg) {
    if (!account) return notify({ tone: 'error', msg: 'Connect your wallet first.' });
    setBusy(fn);
    try {
      const { hash } = await adapter.send(account, fn, args, value ?? 0n, (msg) =>
        notify({ tone: 'info', msg, busy: true }),
      );
      if (fn === 'adjudicate') {
        const fresh = await adapter.getBounty(b.id);
        if (fresh && (fresh.status === 2 || fresh.status === 5)) {
          notify({ tone: 'info', msg: 'Validators were undetermined this round. Click “Run the AI jury” again.' });
        } else {
          notify({ tone: 'success', msg: fresh?.verdict ? `AI jury verdict: ${fresh.verdict}.` : okMsg, hash });
        }
      } else {
        notify({ tone: 'success', msg: okMsg, hash });
      }
      await onRefresh?.();
      if (account && adapter?.getCredit) {
        adapter.getCredit(account).then((c) => {
          if (c !== undefined && c !== null) setUserCredit(String(c));
        }).catch(() => {});
      }
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
          <div className="dstat"><span>{formatGen(b.reward)}</span><label>{sym} reward</label></div>
          <div className="dstat"><span>{formatGen(b.stake_required)}</span><label>{sym} stake</label></div>
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

        {vd && (
          <section className={`verdict-panel tone-${vd.tone}`}>
            <div className="verdict-panel-top">
              <span className="verdict-eyebrow">AI jury verdict · {adapter.verdictSource}</span>
              <span className={`verdict-big tone-${vd.tone}`}>{vd.label}</span>
            </div>
            <div className="verdict-meters">
              <Meter label="Confidence" value={b.confidence} tone={vd.tone} />
              <Meter label="Spec match" value={b.spec_match} tone="cyan" />
              {b.authenticity !== undefined && (
                <Meter label="Authenticity" value={b.authenticity} tone="violet" />
              )}
              {b.originality !== undefined && (
                <Meter label="Originality" value={b.originality} tone="blue" />
              )}
            </div>

            {b.cross_check !== undefined && b.cross_check !== null && CROSS[b.cross_check] && (
              <div className={`crosscheck tone-${CROSS[b.cross_check].tone}`} title={CROSS[b.cross_check].hint}>
                <span className="crosscheck-ico">{CROSS[b.cross_check].icon}</span>
                <span className="crosscheck-label">Live web cross-check · {CROSS[b.cross_check].label}</span>
              </div>
            )}

            {Array.isArray(b.panel) && b.panel.length > 0 && (
              <div className="jury-panel">
                <div className="jury-panel-head">Panel breakdown · three auditor lenses</div>
                <div className="jury-lenses">
                  {b.panel.map((p, i) => (
                    <div key={i} className="lens">
                      <div className="lens-top">
                        <span className="lens-name">{p.lens}</span>
                        {p.score !== undefined && <span className="lens-score mono">{p.score}</span>}
                      </div>
                      <p className="lens-finding">{p.finding}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {b.reason && <blockquote className="verdict-reason">“{b.reason}”</blockquote>}
            {b.appealed && <div className="appeal-note">This verdict was reached on appeal.</div>}
          </section>
        )}

        {rep && (rep.genuine > 0 || rep.fraud > 0) && (
          <section className="rep-row">
            <span className="rep-label">Worker reputation</span>
            <span className={`rep-score ${rep.trust_score >= 60 ? 'good' : 'bad'}`}>{rep.trust_score}% trust</span>
            <span className="rep-detail">{rep.genuine} genuine · {rep.fraud} fraud · {formatGen(rep.earned)} {sym} earned</span>
          </section>
        )}

        <div className="detail-actions">
          {canClaim && (
            <Button busy={busy === 'claim_bounty'} onClick={() => act('claim_bounty', [String(b.id)], BigInt(b.stake_required), 'Bounty claimed. Get to work!')}>
              Claim & stake {formatGen(b.stake_required)} {sym}
            </Button>
          )}
          {b.status === 0 && isClient && cap.hasCancel && (
            <Button variant="ghost" busy={busy === 'cancel_bounty'} onClick={() => act('cancel_bounty', [String(b.id)], 0n, 'Bounty cancelled, reward refunded to your credit.')}>
              Cancel & refund
            </Button>
          )}
          {b.status === 0 && isClient && !cap.hasCancel && <Info>Waiting for a worker to claim this bounty.</Info>}

          {b.status === 1 && isWorker && (
            <div className="submit-row">
              <Field label="Deliverable URL" hint="Public link the jury can read: a gist, PR, article, portfolio page.">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Button busy={busy === 'submit_work'} onClick={submitWork}>Submit for review</Button>
            </div>
          )}
          {b.status === 1 && !isWorker && <Info>Worker is completing the task.</Info>}

          {(b.status === 2 || b.status === 5) && cap.canRunJury && account && (
            <Button variant="jury" busy={busy === 'adjudicate'} onClick={() => act('adjudicate', [String(b.id)], 0n, 'The AI jury has ruled.')}>
              {b.status === 5 ? 'Re-run the AI jury (appeal)' : 'Run the AI jury'}
            </Button>
          )}
          {(b.status === 2 || b.status === 5) && cap.canRunJury && !account && <Info>Connect a wallet to trigger the AI jury.</Info>}
          {b.status === 2 && !cap.canRunJury && (
            <Info>Awaiting the verdict relayed from the GenLayer jury. Once settled, the payout in {sym} appears here.</Info>
          )}

          {b.status === 4 && cap.hasAppeal && isWorker && (
            <Button variant="violet" busy={busy === 'appeal'} onClick={() => act('appeal', [String(b.id)], BigInt(b.stake_required), 'Appeal filed. Re-run the jury.')}>
              Appeal · bond {formatGen(b.stake_required)} {sym}
            </Button>
          )}
          {b.status === 4 && cap.hasFinalize && isClient && (
            appealWindowOpen(b) ? (
              <Info>
                Appeal window open until {fmtWhen(b.finalizable_at)}. The worker can still
                appeal or resubmit, so the grant can’t be finalized yet. You’ll be able to
                finalize and claim the escrow after the window closes.
              </Info>
            ) : (
              <Button variant="ghost" busy={busy === 'finalize_rejection'} onClick={() => act('finalize_rejection', [String(b.id)], 0n, 'Rejection finalized. Escrow moved to your credit.')}>
                Finalize & claim escrow
              </Button>
            )
          )}
          {b.status === 4 && !cap.hasFinalize && isClient && (
            BigInt(userCredit || 0) > 0n ? (
              <div className="claim-box">
                <div className="claim-box-info">
                  Rejected by jury. Your refunded escrow is ready to claim.
                </div>
                <Button variant="lime" busy={busy === 'withdraw' || withdrawing} onClick={handleWithdraw}>
                  Withdraw refund · {formatGen(userCredit)} {sym}
                </Button>
              </div>
            ) : (
              <Info tone="good">Rejected. Escrow was refunded in {sym}.</Info>
            )
          )}
          {b.status === 4 && !cap.hasAppeal && isWorker && <Info tone="bad">Rejected. The client was refunded and your stake was slashed.</Info>}
          {b.status === 4 && !isWorker && !isClient && cap.hasAppeal && <Info>Awaiting the worker&rsquo;s appeal or the client finalizing.</Info>}

          {b.status === 3 && isWorker && BigInt(userCredit || 0) > 0n && (
            <div className="claim-box">
              <div className="claim-box-info">
                🎉 <strong>Work Approved!</strong> The AI jury ruled your deliverable as <strong>GENUINE</strong>.
                Your reward + returned stake ({formatGen(userCredit)} {sym}) are ready to claim.
              </div>
              <Button
                variant="lime"
                busy={busy === 'withdraw' || withdrawing}
                onClick={handleWithdraw}
              >
                Claim {formatGen(userCredit)} {sym} (Reward + Stake)
              </Button>
            </div>
          )}
          {b.status === 3 && isWorker && BigInt(userCredit || 0) === 0n && !loadingCredit && (
            <Info tone="good">✓ Approved · Payout of {formatGen(BigInt(b.reward || 0) + BigInt(b.worker_stake || b.stake_required || 0))} {sym} has been claimed to your wallet ({shortAddr(b.worker)}).</Info>
          )}
          {b.status === 3 && isWorker && BigInt(userCredit || 0) === 0n && loadingCredit && (
            <Info tone="good">Approved. Checking claimable balance…</Info>
          )}
          {b.status === 3 && !isWorker && (
            <Info tone="good">
              {account
                ? isClient
                  ? `Approved by AI jury. Reward of ${formatGen(b.reward)} ${sym} was awarded to the worker (${shortAddr(b.worker)}).`
                  : `Approved by AI jury. Payout awarded to the worker (${shortAddr(b.worker)}).`
                : `Approved. Connect worker wallet (${shortAddr(b.worker)}) to claim payout.`}
            </Info>
          )}

          {b.status === 6 && (
            isClient && BigInt(userCredit || 0) > 0n ? (
              <div className="claim-box">
                <div className="claim-box-info">
                  Fraud upheld. Your escrow refund and slashed worker stake are ready to claim.
                </div>
                <Button variant="lime" busy={busy === 'withdraw' || withdrawing} onClick={handleWithdraw}>
                  Withdraw {formatGen(userCredit)} {sym} (Refund + Slashed Stake)
                </Button>
              </div>
            ) : (
              <Info tone="bad">Fraud upheld. The client was compensated from escrow.</Info>
            )
          )}

          {b.status === 7 && (
            isClient && BigInt(userCredit || 0) > 0n ? (
              <div className="claim-box">
                <div className="claim-box-info">
                  Bounty cancelled. Your refunded reward is ready to claim.
                </div>
                <Button variant="lime" busy={busy === 'withdraw' || withdrawing} onClick={handleWithdraw}>
                  Withdraw {formatGen(userCredit)} {sym} (Refund)
                </Button>
              </div>
            ) : (
              <Info>Cancelled by the client.</Info>
            )
          )}
        </div>

        {adapter.configured() && (
          <a className="explorer-link" href={adapter.explorerAddr(adapter.contract)} target="_blank" rel="noreferrer">
            view contract on {adapter.label} explorer ↗
          </a>
        )}
      </div>
    </Modal>
  );
}

function Info({ children, tone }) {
  return <div className={`info-line ${tone ? 'info-' + tone : ''}`}>{children}</div>;
}

// The client can only finalize a rejection once the worker's protected appeal
// window has elapsed. finalizable_at is epoch seconds from the contract.
function appealWindowOpen(b) {
  const at = Number(b?.finalizable_at || 0);
  return at > 0 && Date.now() / 1000 < at;
}

function fmtWhen(epochSecs) {
  const t = Number(epochSecs || 0);
  if (!t) return 'the appeal window closes';
  try {
    return new Date(t * 1000).toLocaleString();
  } catch {
    return 'the appeal window closes';
  }
}
