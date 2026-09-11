import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from '../components/Header.jsx';
import CreateBounty, { friendly } from '../components/CreateBounty.jsx';
import BountyCard from '../components/BountyCard.jsx';
import BountyModal from '../components/BountyModal.jsx';
import Explorer from '../components/Explorer.jsx';
import { Toast, Empty, Spinner } from '../components/ui.jsx';
import { connectWallet, disconnectWallet, ensureNetwork, getConnectedAddress, onWalletEvents, hasMetaMask } from '../lib/wallet.js';
import { useRoute, navigate } from '../lib/nav.js';
import { useChain } from '../lib/chainContext.jsx';

export default function AppShell() {
  const route = useRoute();
  const view = route.startsWith('/post') ? 'post' : route.startsWith('/explorer') ? 'explorer' : 'browse';
  const { adapter, chainKey } = useChain();

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
    if (!adapter.configured()) { setBounties([]); setConfig({}); setLoading(false); return; }
    try {
      const [list, cfg] = await Promise.all([adapter.listBounties(), adapter.getConfig()]);
      setBounties(list);
      setConfig(cfg || {});
    } catch (e) {
      notify({ tone: 'error', msg: `Could not read the ${adapter.label} contract. Is it deployed and configured?` });
    } finally {
      setLoading(false);
    }
  }, [adapter, notify]);

  const loadAccountData = useCallback(async (addr) => {
    if (!addr || !adapter.configured()) { setBalance(null); setCredit('0'); return; }
    const [bal, cr] = await Promise.all([adapter.getBalance(addr), adapter.getCredit(addr)]);
    setBalance(bal);
    setCredit(cr);
  }, [adapter]);

  const refresh = useCallback(async () => {
    await loadBounties();
    if (account) await loadAccountData(account);
  }, [loadBounties, loadAccountData, account]);

  // Initial wallet detection + wallet event subscription (once).
  useEffect(() => {
    getConnectedAddress().then((a) => { if (a) setAccount(a); });
    const off = onWalletEvents({
      onAccounts: (a) => { setAccount(a); setBalance(null); },
      onChain: () => { if (account) loadAccountData(account); },
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload whenever the active chain changes.
  useEffect(() => {
    setLoading(true);
    loadBounties();
  }, [loadBounties]);

  useEffect(() => { if (account) loadAccountData(account); }, [account, loadAccountData]);

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) loadBounties(); }, 20000);
    return () => clearInterval(id);
  }, [loadBounties]);

  async function connect() {
    setConnecting(true);
    try {
      const a = await connectWallet(chainKey);
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

  // When the user is connected and switches chain, move MetaMask to that network.
  useEffect(() => {
    if (account) ensureNetwork(chainKey).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainKey]);

  async function withdraw() {
    setWithdrawing(true);
    try {
      const { hash } = await adapter.send(account, 'withdraw', [], 0n, (msg) => notify({ tone: 'info', msg, busy: true }));
      notify({ tone: 'success', msg: `Withdrawn to your wallet in ${adapter.symbol}.`, hash });
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
          No wallet detected. Install <a href="https://metamask.io" target="_blank" rel="noreferrer">MetaMask</a> to post or claim bounties.
        </Banner>
      )}
      {!adapter.configured() && (
        <Banner tone="warn">
          The {adapter.label} contract address is not set for this build.
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
            adapter={adapter}
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
                  Escrow a reward in {adapter.symbol} on {adapter.label} and describe what genuine, on-spec work
                  looks like. The GenLayer AI jury judges the delivered work before a single {adapter.symbol} is released.
                </p>
              </div>
            </div>
            <CreateBounty account={account} notify={notify} onDone={() => { navigate('/app'); refresh(); }} />
          </section>
        )}

        {view === 'explorer' && (
          <Explorer bounties={bounties} loading={loading} adapter={adapter} onOpen={(x) => setSelectedId(x.id)} />
        )}
      </main>

      <footer className="site-footer">
        <span>Proof of Sweat, judged on <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a>, settled on {adapter.label}</span>
        {adapter.configured() && (
          <a className="mono" href={adapter.explorerAddr(adapter.contract)} target="_blank" rel="noreferrer">{adapter.contract}</a>
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

function BrowseView({ bounties, loading, account, config, open, resolved, adapter, onOpen, onRefresh }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bounty board</h1>
          <p className="page-sub">
            Post work, stake, submit, and let the AI jury settle it. Rewards on {adapter.label} are held and
            paid in {adapter.symbol}. Open a card for the full spec and, once judged, the verdict and reasoning.
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
