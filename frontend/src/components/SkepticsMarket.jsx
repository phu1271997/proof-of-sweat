import React, { useEffect, useState } from 'react';
import { Button, Field } from './ui.jsx';
import { formatGen, parseGen, shortAddr } from '../lib/format.js';
import { friendly } from './CreateBounty.jsx';

// The staker picks a side; the fresh AI re-trial decides which side wins.
const SIDES = [
  { key: 'GENUINE', label: 'Genuine', hint: 'the jury was right — the work is real', tone: 'lime' },
  { key: 'FAKE', label: 'Fake', hint: 'the jury was wrong — the work is fraud', tone: 'red' },
];

const WIN = { 0: null, 1: 'GENUINE', 2: 'FAKE' };

function countdown(epochSecs) {
  const t = Number(epochSecs || 0);
  const left = Math.max(0, Math.floor(t - Date.now() / 1000));
  if (left <= 0) return 'window closed';
  const m = Math.floor(left / 60);
  const s = left % 60;
  return m > 0 ? `${m}m ${s}s left` : `${s}s left`;
}

/**
 * The Skeptics' Market (v0.6): a permissionless, staked second opinion on a
 * bounty whose verdict the jury already settled. Anyone stakes GEN on GENUINE vs
 * FAKE; when the window closes, resolve_challenge runs the same on-chain AI
 * courtroom again as a trustless settler and the winning side splits the pot.
 */
export default function SkepticsMarket({ bounty, account, adapter, notify, onRefresh }) {
  const sym = adapter.symbol;
  const b = bounty;
  const [ch, setCh] = useState(undefined); // undefined=loading, null=none
  const [side, setSide] = useState('FAKE');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState('');
  const [credit, setCredit] = useState('0');
  const [, forceTick] = useState(0);

  const resolved = b.status === 3 || b.status === 6;

  async function load() {
    if (!adapter.getChallenge) return setCh(null);
    try {
      const c = await adapter.getChallenge(b.id);
      setCh(c || null);
    } catch {
      setCh(null);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [b?.id, b?.status, b?.challenge_id]);

  useEffect(() => {
    let active = true;
    if (account && adapter.getCredit) {
      adapter.getCredit(account).then((c) => { if (active) setCredit(String(c || '0')); }).catch(() => {});
    }
    return () => { active = false; };
  }, [account, adapter, ch?.status]);

  // Re-render once a second so the countdown ticks while a challenge is open.
  useEffect(() => {
    if (!ch || ch.status !== 0) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [ch?.status, ch?.closes_at]);

  if (!adapter.cap?.hasMarket || !resolved) return null;

  async function act(fn, args, value, okMsg) {
    if (!account) return notify({ tone: 'error', msg: 'Connect your wallet first.' });
    setBusy(fn);
    try {
      const { hash } = await adapter.send(account, fn, args, value ?? 0n, (msg) =>
        notify({ tone: 'info', msg, busy: true }),
      );
      notify({ tone: 'success', msg: okMsg, hash });
      await load();
      await onRefresh?.();
    } catch (err) {
      notify({ tone: 'error', msg: friendly(err) });
    } finally {
      setBusy('');
    }
  }

  const stake = () => {
    const wei = parseGen(amount);
    if (wei <= 0n) return notify({ tone: 'error', msg: `Enter a ${sym} amount to stake.` });
    const open = !ch;
    const fn = open ? 'open_challenge' : 'back_challenge';
    act(fn, [String(b.id), side], wei, open ? 'Challenge opened. The market is live.' : 'Stake placed.');
  };

  const potG = BigInt(ch?.pot_genuine || 0);
  const potF = BigInt(ch?.pot_fake || 0);
  const total = potG + potF;
  const pctG = total > 0n ? Number((potG * 100n) / total) : 50;

  return (
    <section className="market">
      <div className="market-head">
        <span className="market-ico">🪙</span>
        <div>
          <div className="market-title">Skeptics’ Market</div>
          <div className="market-sub">
            Stake {sym} on whether the jury got this right. A fresh on-chain AI re-trial settles the pot.
          </div>
        </div>
      </div>

      {/* No challenge yet — invite the first stake */}
      {ch === null && (
        <>
          <p className="market-note">
            The jury ruled <strong>{b.verdict || (b.status === 3 ? 'GENUINE' : 'FRAUD')}</strong>. Disagree?
            Put {sym} behind your call. If a fresh AI re-trial agrees with your side after the stake window,
            you split the whole pot — and an overturn rewrites the worker’s on-chain reputation.
          </p>
          <StakeForm {...{ side, setSide, amount, setAmount, sym, busy, onStake: stake, label: 'Open challenge' }} />
        </>
      )}

      {/* Open challenge — show pots + countdown + stake form */}
      {ch && ch.status === 0 && (
        <>
          <div className="pot-bar" title={`${formatGen(potG)} ${sym} GENUINE · ${formatGen(potF)} ${sym} FAKE`}>
            <div className="pot-fill pot-genuine" style={{ width: `${pctG}%` }} />
            <div className="pot-fill pot-fake" style={{ width: `${100 - pctG}%` }} />
          </div>
          <div className="pot-legend">
            <span className="lime">● Genuine {formatGen(potG)} {sym}</span>
            <span className="red">● Fake {formatGen(potF)} {sym}</span>
            <span className="muted">pot {formatGen(total)} {sym}</span>
          </div>

          {ch.open_now ? (
            <>
              <div className="market-timer">⏳ {countdown(ch.closes_at)} to stake</div>
              <StakeForm {...{ side, setSide, amount, setAmount, sym, busy, onStake: stake, label: 'Back a side' }} />
            </>
          ) : (
            <>
              <div className="market-timer">Stake window closed — ready to settle.</div>
              <Button variant="jury" busy={busy === 'resolve_challenge'}
                onClick={() => act('resolve_challenge', [String(b.id)], 0n, 'Settled by a fresh on-chain AI re-trial.')}>
                Settle with a fresh AI re-trial
              </Button>
              {!account && <div className="info-line">Connect a wallet to settle the market.</div>}
            </>
          )}
        </>
      )}

      {/* Settled */}
      {ch && (ch.status === 1 || ch.status === 2) && (
        <div className={`market-result ${ch.status === 2 ? 'void' : WIN[ch.winning_side] === 'GENUINE' ? 'lime' : 'red'}`}>
          <div className="market-result-top">
            {ch.status === 2 ? (
              <span>Re-trial was <strong>UNCLEAR</strong> → market VOID, every stake refunded.</span>
            ) : (
              <>
                <span>Fresh re-trial ruled <strong>{ch.fresh_verdict}</strong> → <strong>{WIN[ch.winning_side]}</strong> side wins the {formatGen(total)} {sym} pot.</span>
                {ch.overturned && <span className="overturn-badge">⚖️ OVERTURNED the jury</span>}
              </>
            )}
          </div>
          {ch.fresh_reason && <blockquote className="verdict-reason">“{ch.fresh_reason}”</blockquote>}
          {(ch.prosecution || ch.defense) && (
            <div className="briefs mini">
              <div className="brief brief-pros"><span className="brief-tag">Re-trial prosecution</span><p>{ch.prosecution}</p></div>
              <div className="brief brief-def"><span className="brief-tag">Re-trial defense</span><p>{ch.defense}</p></div>
            </div>
          )}
          {account && BigInt(credit || 0) > 0n && (
            <Button variant="lime" busy={busy === 'withdraw'}
              onClick={() => act('withdraw', [], 0n, `Winnings withdrawn to ${shortAddr(account)}.`)}>
              Withdraw winnings · {formatGen(credit)} {sym}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function StakeForm({ side, setSide, amount, setAmount, sym, busy, onStake, label }) {
  return (
    <div className="market-stake">
      <div className="side-pick">
        {SIDES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`side-chip side-${s.tone} ${side === s.key ? 'on' : ''}`}
            onClick={() => setSide(s.key)}
            title={s.hint}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Field label={`Stake (${sym})`} hint="Winners split the whole pot pro-rata. Wrong side loses its stake.">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.02" inputMode="decimal" />
      </Field>
      <Button busy={busy === 'open_challenge' || busy === 'back_challenge'} onClick={onStake}>
        {label}
      </Button>
    </div>
  );
}
