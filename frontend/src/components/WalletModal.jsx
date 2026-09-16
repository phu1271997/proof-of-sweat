import React from 'react';
import { WALLETS } from '../lib/wallet.js';
import { Spinner } from './ui.jsx';

export default function WalletModal({ isOpen, onClose, onSelect, connectingId }) {
  if (!isOpen) return null;

  const wallets = WALLETS.map((w) => ({
    ...w,
    isInstalled: !!w.getProvider(),
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wallet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="wallet-modal-head">
          <h2 className="modal-title">Connect a wallet</h2>
          <p className="wallet-modal-sub">
            Connect using MetaMask, OKX Wallet, Rabby, or any browser-injected EVM wallet.
          </p>
        </div>

        <div className="wallet-list">
          {wallets.map((wallet) => {
            const isConnecting = connectingId === wallet.id;
            return (
              <div
                key={wallet.id}
                role="button"
                tabIndex={0}
                className={`wallet-option ${wallet.isInstalled ? 'is-available' : 'is-uninstalled'}`}
                onClick={() => {
                  if (wallet.isInstalled) {
                    onSelect(wallet.id);
                  } else if (wallet.installUrl) {
                    window.open(wallet.installUrl, '_blank', 'noreferrer');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (wallet.isInstalled) onSelect(wallet.id);
                    else if (wallet.installUrl) window.open(wallet.installUrl, '_blank', 'noreferrer');
                  }
                }}
              >
                <div className="wallet-option-icon">
                  <WalletIcon id={wallet.id} />
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">{wallet.name}</div>
                  <div className="wallet-option-desc">{wallet.description}</div>
                </div>
                <div className="wallet-option-action">
                  {isConnecting ? (
                    <Spinner size={16} />
                  ) : wallet.isInstalled ? (
                    <span className="wallet-status-badge is-detected">Detected</span>
                  ) : (
                    <span className="wallet-status-badge is-missing">Install ↗</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WalletIcon({ id }) {
  if (id === 'metamask') {
    return (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M28.4 4L17.5 12.1l2.4-5.8L28.4 4z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.5"/>
        <path d="M3.6 4l10.8 8.1-2.4-5.8L3.6 4z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5"/>
        <path d="M24.2 21.6l-3.2 4.9 6.8 1.9 2-6.7-5.6-.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5"/>
        <path d="M2.2 21.7l2 6.7 6.8-1.9-3.2-4.9-5.6.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5"/>
        <path d="M9.8 14.1l-1.9 2.9 6.7.3-.2-7.3-4.6 4.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5"/>
        <path d="M22.2 14.1l-4.6-4.2-.2 7.3 6.7-.3-1.9-2.8z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5"/>
        <path d="M11 26.5l3.9-1.9-3.4-2.7L11 26.5z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5"/>
        <path d="M21 26.5l-0.5-4.6-3.4 2.7 3.9 1.9z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5"/>
        <path d="M14.9 24.6l-3.8 1.9 3.2 1.8 1.4-3.1-.8-.6z" fill="#233447" stroke="#233447" strokeWidth="0.5"/>
        <path d="M17.1 24.6l-.8.6 1.4 3.1 3.2-1.8-3.8-1.9z" fill="#233447" stroke="#233447" strokeWidth="0.5"/>
        <path d="M7.8 17l4.7 9.1-1.5-4.2L7.8 17z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5"/>
        <path d="M24.2 17l-3.2 4.9-1.5 4.2 4.7-9.1z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5"/>
        <path d="M17.4 17.3l.2-7.3 2.3-4.2-7.8 0 2.3 4.2.2 7.3 1.4 4 1.4-4z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.5"/>
      </svg>
    );
  }
  if (id === 'okx') {
    return (
      <svg viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#000000"/>
        <path d="M7 7h6v6H7V7zm12 0h6v6h-6V7zm-6 6h6v6h-6v-6zm-6 6h6v6H7v-6zm12 0h6v6h-6v-6z" fill="#FFFFFF"/>
      </svg>
    );
  }
  if (id === 'rabby') {
    return (
      <svg viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#8B96FE"/>
        <path d="M10 7c0-2 2-3 4-2l2 4c-3 0-5 0-6-2zm12 0c0-2-2-3-4-2l-2 4c3 0 5 0 6-2z" fill="#FFFFFF"/>
        <circle cx="16" cy="18" r="8" fill="#FFFFFF"/>
        <circle cx="13" cy="17" r="1.8" fill="#1e1e38"/>
        <circle cx="19" cy="17" r="1.8" fill="#1e1e38"/>
        <ellipse cx="16" cy="21" rx="1.5" ry="1" fill="#FF8D96"/>
      </svg>
    );
  }
  // Generic injected browser wallet
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M16 12h.01"/>
      <path d="M2 10h20"/>
    </svg>
  );
}
