import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from '../components/Header.jsx';
import CreateBounty, { friendly } from '../components/CreateBounty.jsx';
import BountyCard from '../components/BountyCard.jsx';
import BountyModal from '../components/BountyModal.jsx';
import Explorer from '../components/Explorer.jsx';
import { Toast, Empty, Spinner } from '../components/ui.jsx';
import {
  fetchBounties, fetchConfig, fetchCredit, fetchNativeBalance, send, contractConfigured, CONTRACT,
} from '../lib/genlayer.js';
import { connectWallet, disconnectWallet, getConnectedAddress, onWalletEvents, hasMetaMask } from '../lib/wallet.js';
import { EXPLORER } from '../lib/format.js';
import { useRoute, navigate } from '../lib/nav.js';

export default function AppShell() {
  const route = useRoute();
  const view = route.startsWith('/post') ? 'post' : route.startsWith('/explorer') ? 'explorer' : 'browse';

  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [credit, setCredit] = useState('0');
  const [bounties, setBounties] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
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

  async function disconnect() {
    await disconnectWallet();
    setAccount(null);
    setBalance(null);
    setCredit('0');
    notify({ tone: 'info', msg: 'Wallet disconnected.' });
  }

  async function withdraw() {
    setWithdrawing(true);
    try {
      const { hash } = await send(account, 'withdraw', [], 0n, (msg) => notify({ tone: 'info', msg, busy: true }));
      notify({ tone: 'success', msg: 'Withdrawn to your wallet.', hash });
      await refresh();
      setTimeout(() => { if (account) loadAccountData(account); }, 6000);
    } catch (e) {
      notify({ tone: 'error', msg: friendly(e) });
    } finally {
      setWithdrawing(false);
    }
  }

  const selected = bounties.find((b) => b.id === selectedId) || null;
  const open = bounties.filter((b) => b.status === 0).length;
  const resolved = bounties.filter((b) => [3, 4, 6].includes(b.status)).length;

  return (
    <div className="app">
      <Header
        route={route}
        account={account}
        balance={balance}
        credit={credit}
        onConnect={connect}
        onDisconnect={disconnect}
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

      <main className="main">
        {view === 'browse' && (
          <BrowseView
            bounties={bounties}
            loading={loading}
            account={account}
            config={config}
            open={open}
            resolved={resolved}
            onOpen={(x) => setSelectedId(x.id)}
            onRefresh={refresh}
          />
        )}

        {view === 'post' && (
          <section className="page">
            <div className="page-head">
              <div>
                <h1 className="page-title">Post a bounty</h1>
                <p className="page-sub">
                  Escrow a reward and describe what genuine, on-spec work looks like. The AI jury judges the
                  delivered work against it before a single GEN is released.
                </p>
              </div>
            </div>
            <CreateBounty account={account} notify={notify} onDone={() => { navigate('/app'); refresh(); }} />
          </section>
        )}

        {view === 'explorer' && (
          <Explorer bounties={bounties} loading={loading} onOpen={(x) => setSelectedId(x.id)} />
        )}
      </main>

      <footer className="site-footer">
        <span>Proof of Sweat, built on <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a> studionet</span>
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

function BrowseView({ bounties, loading, account, config, open, resolved, onOpen, onRefresh }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bounty board</h1>
          <p className="page-sub">
            Post work, stake, submit, and let the AI jury settle it on-chain. Open a card to see the full
            spec and, once judged, the verdict and the AI's reasoning.
          </p>
        </div>
        <div className="page-stats">
          <div><b>{config.total_bounties ?? bounties.length}</b><span>posted</span></div>
          <div><b>{open}</b><span>open</span></div>
          <div><b>{resolved}</b><span>resolved</span></div>
          <button className="refresh-btn" onClick={onRefresh} title="Refresh">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap"><Spinner size={28} /><span>Loading bounties</span></div>
      ) : bounties.length === 0 ? (
        <Empty title="No bounties yet">
          Be the first: post a bounty and let the AI jury settle it.
        </Empty>
      ) : (
        <div className="grid">
          {bounties.map((b) => (
            <BountyCard key={b.id} b={b} account={account} onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  );
}

function Banner({ tone, children }) {
  return <div className={`banner banner-${tone}`}>{children}</div>;
}
