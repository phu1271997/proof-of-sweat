import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import CreateBounty from './components/CreateBounty.jsx';
import BountyCard from './components/BountyCard.jsx';
import BountyModal from './components/BountyModal.jsx';
import { Toast, Empty, Button, Spinner } from './components/ui.jsx';
import { friendly } from './components/CreateBounty.jsx';
import {
  fetchBounties, fetchConfig, fetchCredit, fetchNativeBalance, send, contractConfigured, CONTRACT,
} from './lib/genlayer.js';
import { connectWallet, getConnectedAddress, onWalletEvents, hasMetaMask } from './lib/wallet.js';
import { formatGen, EXPLORER } from './lib/format.js';

export default function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [credit, setCredit] = useState('0');
  const [bounties, setBounties] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [tab, setTab] = useState('browse');
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((t) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    if (t && !t.busy) toastTimer.current = setTimeout(() => setToast(null), 6500);
  }, []);

  const loadBounties = useCallback(async () => {
    if (!contractConfigured()) { setLoading(false); return; }
    try {
      const [list, cfg] = await Promise.all([fetchBounties(), fetchConfig()]);
      setBounties(list);
      setConfig(cfg || {});
    } catch (e) {
      notify({ tone: 'error', msg: 'Could not read the contract. Is VITE_CONTRACT_ADDRESS correct and deployed on studionet?' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadAccountData = useCallback(async (addr) => {
    if (!addr || !contractConfigured()) return;
    const [bal, cr] = await Promise.all([fetchNativeBalance(addr), fetchCredit(addr)]);
    setBalance(bal);
    setCredit(cr);
  }, []);

  const refresh = useCallback(async () => {
    await loadBounties();
    if (account) await loadAccountData(account);
  }, [loadBounties, loadAccountData, account]);

  useEffect(() => {
    loadBounties();
    getConnectedAddress().then((a) => { if (a) setAccount(a); });
    const off = onWalletEvents({
      onAccounts: (a) => { setAccount(a); setBalance(null); },
      onChain: () => refresh(),
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (account) loadAccountData(account); }, [account, loadAccountData]);

  // light background refresh so others' actions show up
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) loadBounties(); }, 20000);
    return () => clearInterval(id);
  }, [loadBounties]);

  async function connect() {
    setConnecting(true);
    try {
      const a = await connectWallet();
      setAccount(a);
    } catch (e) {
      notify({ tone: 'error', msg: hasMetaMask() ? friendly(e) : 'MetaMask not detected. Install it to continue.' });
    } finally {
      setConnecting(false);
    }
  }

  async function withdraw() {
    setWithdrawing(true);
    try {
      const { hash } = await send(account, 'withdraw', [], 0n, (msg) => notify({ tone: 'info', msg, busy: true }));
      notify({ tone: 'success', msg: 'Withdrawn to your wallet.', hash });
      await refresh();
    } catch (e) {
      notify({ tone: 'error', msg: friendly(e) });
    } finally {
      setWithdrawing(false);
    }
  }

  const selected = bounties.find((b) => b.id === selectedId) || null;
  const open = bounties.filter((b) => b.status === 0).length;

  return (
    <div className="app">
      <Header
        account={account}
        balance={balance}
        credit={credit}
        onConnect={connect}
        onWithdraw={withdraw}
        connecting={connecting}
        withdrawing={withdrawing}
      />

      {!hasMetaMask() && (
        <Banner tone="info">
          No wallet detected. Install <a href="https://metamask.io" target="_blank" rel="noreferrer">MetaMask</a> and fund an account on GenLayer studionet to post or claim bounties.
        </Banner>
      )}
      {!contractConfigured() && (
        <Banner tone="warn">
          Contract address not set. Deploy <code>contracts/proof_of_sweat.py</code> on GenLayer Studio and put its address in <code>frontend/.env</code> as <code>VITE_CONTRACT_ADDRESS</code>.
        </Banner>
      )}

      <section className="hero">
        <div className="hero-eyebrow">GenLayer · Agent Tank · Future of Work</div>
        <h1 className="hero-title">
          GET PAID FOR <span className="hl">REAL</span> WORK.<br />
          <span className="hero-title-2">AI-SLOP GETS NOTHING.</span>
        </h1>
        <p className="hero-sub">
          Post a bounty and escrow the reward. A worker stakes and delivers. A decentralized
          jury of validators — each running a different LLM — reads the deliverable on-chain and
          reaches <strong>consensus</strong> on whether it is genuine human effort. Only then is the
          money released.
        </p>
        <p className="hero-why">
          Why it can only exist on GenLayer: judging “is this genuine or AI-generated slop?” needs
          subjective reasoning over live web content — impossible for a normal smart contract.
        </p>
        <div className="hero-cta">
          <Button onClick={() => setTab('post')}>Post a bounty</Button>
          <Button variant="ghost" onClick={() => setTab('browse')}>Browse bounties</Button>
          <div className="hero-stats">
            <div><b>{config.total_bounties ?? bounties.length}</b> posted</div>
            <div><b>{open}</b> open</div>
            <div><b>{config.confidence_threshold ?? 60}%</b> min confidence</div>
          </div>
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>Bounties</button>
        <button className={tab === 'post' ? 'active' : ''} onClick={() => setTab('post')}>Post a bounty</button>
        <button className="refresh" onClick={refresh} title="Refresh">↻</button>
      </nav>

      <main className="main">
        {tab === 'post' && <CreateBounty account={account} notify={notify} onDone={() => { setTab('browse'); refresh(); }} />}

        {tab === 'browse' && (
          <>
            {loading ? (
              <div className="loading-wrap"><Spinner size={28} /><span>Loading bounties…</span></div>
            ) : bounties.length === 0 ? (
              <Empty title="No bounties yet">
                Be the first — post a bounty and let the AI jury settle it. {contractConfigured() && (
                  <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">view contract ↗</a>
                )}
              </Empty>
            ) : (
              <div className="grid">
                {bounties.map((b) => (
                  <BountyCard key={b.id} b={b} account={account} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <span>Proof of Sweat · built on <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a> studionet</span>
        {contractConfigured() && (
          <a className="mono" href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">{CONTRACT}</a>
        )}
      </footer>

      {selected && (
        <BountyModal
          bounty={selected}
          account={account}
          onClose={() => setSelectedId(null)}
          onRefresh={refresh}
          notify={notify}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

function Banner({ tone, children }) {
  return <div className={`banner banner-${tone}`}>{children}</div>;
}
