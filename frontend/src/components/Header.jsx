import React from 'react';
import { Button, Spinner } from './ui.jsx';
import { formatGen, shortAddr } from '../lib/format.js';
import { linkProps } from '../lib/nav.js';

const NAV = [
  ['/app', 'Bounties'],
  ['/post', 'Post'],
  ['/explorer', 'Explorer'],
];

export default function Header({ route = '', account, balance, credit, onConnect, onDisconnect, onWithdraw, connecting, withdrawing }) {
  const hasCredit = credit && BigInt(credit) > 0n;
  const isActive = (p) => route === p || route.startsWith(`${p}/`);
  return (
    <header className="site-header">
      <a className="brand" {...linkProps('/')}>
        <img className="brand-mark" src="/logo.png" alt="Proof of Sweat" />
        <div className="brand-text">
          <div className="brand-name">PROOF <span>OF</span> SWEAT</div>
          <div className="brand-tag">work verified by AI consensus</div>
        </div>
      </a>

      <nav className="app-nav">
        {NAV.map(([to, label]) => (
          <a key={to} className={`app-nav-link ${isActive(to) ? 'is-active' : ''}`} {...linkProps(to)}>
            {label}
          </a>
        ))}
      </nav>

      <div className="header-right">
        {account ? (
          <>
            {hasCredit && (
              <Button variant="lime" onClick={onWithdraw} busy={withdrawing}>
                Withdraw {formatGen(credit)} GEN
              </Button>
            )}
            <div className="wallet-chip" title={account}>
              <span className="wallet-dot" />
              <div className="wallet-meta">
                <span className="mono wallet-addr">{shortAddr(account)}</span>
                <span className="wallet-bal">{balance == null ? <Spinner size={10} /> : `${formatGen(balance)} GEN`}</span>
              </div>
            </div>
            <button className="disconnect-btn" onClick={onDisconnect} title="Disconnect wallet">Disconnect</button>
          </>
        ) : (
          <Button onClick={onConnect} busy={connecting}>
            Connect MetaMask
          </Button>
        )}
      </div>
    </header>
  );
}
