import React, { useState } from 'react';
import { Button, Field } from './ui.jsx';
import { parseGen } from '../lib/format.js';
import { send } from '../lib/genlayer.js';

const SAMPLE = {
  title: 'Write a 600-word explainer on GenLayer consensus',
  spec: 'Write an original 600-word explainer of GenLayer\'s Optimistic Democracy for a developer audience. Must be technically accurate, concrete, and your own words.',
  rules: 'No AI-generated text. No copy-paste from the docs. Original phrasing only.',
};

export default function CreateBounty({ account, onDone, notify }) {
  const [title, setTitle] = useState('');
  const [spec, setSpec] = useState('');
  const [rules, setRules] = useState('');
  const [reward, setReward] = useState('');
  const [stake, setStake] = useState('');
  const [busy, setBusy] = useState(false);

  const fill = () => {
    setTitle(SAMPLE.title);
    setSpec(SAMPLE.spec);
    setRules(SAMPLE.rules);
    setReward('5');
    setStake('1');
  };

  async function submit(e) {
    e.preventDefault();
    if (!account) return notify({ tone: 'error', msg: 'Connect your wallet first.' });
    const rewardWei = parseGen(reward);
    const stakeWei = parseGen(stake);
    if (rewardWei <= 0n) return notify({ tone: 'error', msg: 'Reward must be greater than 0.' });
    if (!title.trim() || !spec.trim()) return notify({ tone: 'error', msg: 'Title and spec are required.' });

    setBusy(true);
    try {
      const { hash } = await send(
        account,
        'create_bounty',
        [title.trim(), spec.trim(), rules.trim(), stakeWei],
        rewardWei,
        (msg) => notify({ tone: 'info', msg, busy: true }),
      );
      notify({ tone: 'success', msg: 'Bounty posted and funded.', hash });
      setTitle(''); setSpec(''); setRules(''); setReward(''); setStake('');
      onDone?.();
    } catch (err) {
      notify({ tone: 'error', msg: friendly(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel create-panel" onSubmit={submit}>
      <div className="panel-head">
        <h2 className="panel-title">Post a bounty</h2>
        <button type="button" className="link-btn" onClick={fill}>use sample</button>
      </div>
      <p className="panel-sub">
        You escrow the reward now. It is released to the worker only if the AI jury rules the
        delivered work <strong>genuine</strong>.
      </p>

      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short task name" maxLength={120} />
      </Field>
      <Field label="Spec — what must be delivered" hint="Be specific: the jury judges the deliverable against this.">
        <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={4} placeholder="Describe exactly what genuine, on-spec work looks like." />
      </Field>
      <Field label="Rules" hint="e.g. no AI-generated content, must be original, no plagiarism.">
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={2} placeholder="Constraints the worker must follow." />
      </Field>
      <div className="grid-2">
        <Field label="Reward (GEN)" hint="Escrowed now.">
          <input value={reward} onChange={(e) => setReward(e.target.value)} inputMode="decimal" placeholder="5" />
        </Field>
        <Field label="Worker stake (GEN)" hint="Skin in the game, slashed on fraud.">
          <input value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" placeholder="1" />
        </Field>
      </div>
      <Button type="submit" busy={busy}>Escrow reward & post</Button>
    </form>
  );
}

export function friendly(err) {
  const raw = err?.shortMessage || err?.details || err?.message || String(err);
  if (/user rejected|denied/i.test(raw)) return 'Signature rejected in MetaMask.';
  if (/insufficient/i.test(raw)) return 'Insufficient GEN balance on studionet — fund your wallet from Studio → Accounts.';
  if (/from/i.test(raw) && /rpc/i.test(raw)) return 'MetaMask is on the wrong network. Reconnect to switch to studionet.';
  // surface a UserError reason if present
  const m = raw.match(/UserError[^"]*"?([^"}]+)"?/);
  return m ? m[1] : raw.slice(0, 180);
}
