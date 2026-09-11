import { studionet } from 'genlayer-js/chains';
import { arcChain } from './chains.js';

const toHex = (id) => '0x' + Number(id).toString(16);

// Per-chain MetaMask network parameters (for switch / add).
const NETWORKS = {
  genlayer: {
    chainIdHex: toHex(studionet.id),
    params: {
      chainId: toHex(studionet.id),
      chainName: studionet.name,
      nativeCurrency: studionet.nativeCurrency,
      rpcUrls: studionet.rpcUrls.default.http,
      blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
    },
  },
  arc: {
    chainIdHex: toHex(arcChain.id),
    params: {
      chainId: toHex(arcChain.id),
      chainName: arcChain.name,
      nativeCurrency: arcChain.nativeCurrency,
      rpcUrls: arcChain.rpcUrls.default.http,
      blockExplorerUrls: ['https://testnet.arcscan.app'],
    },
  },
};

export function hasMetaMask() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

// Remember an explicit disconnect so we don't silently auto-reconnect on reload.
const DISCONNECT_KEY = 'pos_wallet_disconnected';
export function isDisconnected() {
  try { return localStorage.getItem(DISCONNECT_KEY) === '1'; } catch { return false; }
}
function setDisconnected(v) {
  try { v ? localStorage.setItem(DISCONNECT_KEY, '1') : localStorage.removeItem(DISCONNECT_KEY); } catch {}
}

export async function disconnectWallet() {
  setDisconnected(true);
  try {
    await window.ethereum?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  } catch {
    // older MetaMask has no revoke; the local flag still disconnects the app
  }
}

/** Ensure MetaMask is on the given chain, adding the network if needed. */
export async function ensureNetwork(chainKey = 'genlayer') {
  if (!hasMetaMask()) throw new Error('MetaMask not found');
  const net = NETWORKS[chainKey] || NETWORKS.genlayer;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainIdHex }] });
  } catch (err) {
    if (err && (err.code === 4902 || err.code === -32603)) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [net.params] });
    } else {
      throw err;
    }
  }
}

/** Connect MetaMask, switch to the given chain, return the checksum address. */
export async function connectWallet(chainKey = 'genlayer') {
  if (!hasMetaMask()) throw new Error('MetaMask not found');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  setDisconnected(false);
  await ensureNetwork(chainKey);
  return accounts[0];
}

export async function getConnectedAddress() {
  if (!hasMetaMask() || isDisconnected()) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts && accounts.length ? accounts[0] : null;
}

export function onWalletEvents({ onAccounts, onChain }) {
  if (!hasMetaMask()) return () => {};
  const a = (accs) => onAccounts?.(accs && accs.length ? accs[0] : null);
  const c = (cid) => onChain?.(cid);
  window.ethereum.on('accountsChanged', a);
  window.ethereum.on('chainChanged', c);
  return () => {
    window.ethereum.removeListener?.('accountsChanged', a);
    window.ethereum.removeListener?.('chainChanged', c);
  };
}
