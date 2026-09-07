import React from 'react';
import { Button, Spinner } from './ui.jsx';
import { formatGen, shortAddr } from '../lib/format.js';
import { linkProps } from '../lib/nav.js';

export default function Header({ account, balance, credit, onConnect, onDisconnect, onWithdraw, connecting, withdrawing }) {
  const hasCredit = credit && BigInt(credit) > 0n;
  return (
    <header className="site-header">
      <a className="brand" {...linkProps('/')}>
        <div className="brand-mark">PoS</div>
        <div className="brand-text">
          <div className="brand-name">PROOF <span>OF</span> SWEAT</div>
          <div className="brand-tag">work verified by AI consensus</div>
        </div>
      </a>

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
