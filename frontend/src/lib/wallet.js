import { studioDevnet } from 'genlayer-js/chains';
import { arcChain } from './chains.js';

const toHex = (id) => '0x' + Number(id).toString(16);

// Per-chain network parameters (for switch / add).
const NETWORKS = {
  genlayer: {
    chainIdHex: toHex(61997), // 0xF22D
    params: {
      chainId: toHex(61997),
      chainName: 'GenLayer Studio Next',
      nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
      rpcUrls: ['https://studio-next.genlayer.com/api'],
      blockExplorerUrls: ['https://explorer-studio-dev.genlayer.com'],
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

// ── Multi-wallet provider detection ──────────────────────────────────────────

function getInjectedProviders() {
  if (typeof window === 'undefined') return [];
  if (Array.isArray(window.ethereum?.providers)) {
    return window.ethereum.providers;
  }
  return window.ethereum ? [window.ethereum] : [];
}

export function getOkxProvider() {
  if (typeof window === 'undefined') return null;
  if (window.okxwallet) return window.okxwallet;
  const inArray = getInjectedProviders().find((p) => p.isOkxWallet);
  if (inArray) return inArray;
  if (window.ethereum?.isOkxWallet) return window.ethereum;
  return null;
}

export function getRabbyProvider() {
  if (typeof window === 'undefined') return null;
  if (window.rabby) return window.rabby;
  const inArray = getInjectedProviders().find((p) => p.isRabby);
  if (inArray) return inArray;
  if (window.ethereum?.isRabby) return window.ethereum;
  return null;
}

export function getMetaMaskProvider() {
  if (typeof window === 'undefined') return null;
  const inArray = getInjectedProviders().find((p) => p.isMetaMask && !p.isRabby && !p.isOkxWallet);
  if (inArray) return inArray;
  if (window.ethereum?.isMetaMask && !window.ethereum?.isRabby && !window.ethereum?.isOkxWallet) {
    return window.ethereum;
  }
  if (window.ethereum && !window.ethereum.isRabby && !window.ethereum.isOkxWallet) {
    return window.ethereum;
  }
  return null;
}

export function getBrowserProvider() {
  if (typeof window === 'undefined') return null;
  return window.ethereum || null;
}

export const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    getProvider: getMetaMaskProvider,
    installUrl: 'https://metamask.io/download/',
    description: 'Popular multi-chain Web3 wallet',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    getProvider: getOkxProvider,
    installUrl: 'https://www.okx.com/web3',
    description: 'Multi-chain Web3 wallet by OKX',
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    getProvider: getRabbyProvider,
    installUrl: 'https://rabby.io/',
    description: 'Game-changing Web3 wallet for Ethereum',
  },
  {
    id: 'injected',
    name: 'Browser Wallet',
    getProvider: getBrowserProvider,
    installUrl: null,
    description: 'Default injected EVM provider',
  },
];

export function hasAnyWallet() {
  if (typeof window === 'undefined') return false;
  return !!(window.ethereum || window.okxwallet || window.rabby);
}

// Backward-compatibility alias
export function hasMetaMask() {
  return hasAnyWallet();
}

// ── Active Provider Management ───────────────────────────────────────────────

let _activeProvider = null;
const WALLET_ID_KEY = 'pos_wallet_id';
const DISCONNECT_KEY = 'pos_wallet_disconnected';

export function getSavedWalletId() {
  try { return localStorage.getItem(WALLET_ID_KEY); } catch { return null; }
}

export function setSavedWalletId(id) {
  try {
    if (id) {
      localStorage.setItem(WALLET_ID_KEY, id);
    } else {
      localStorage.removeItem(WALLET_ID_KEY);
    }
  } catch {}
}

export function getProviderById(id) {
  if (id === 'okx') return getOkxProvider();
  if (id === 'rabby') return getRabbyProvider();
  if (id === 'metamask') return getMetaMaskProvider();
  if (id === 'injected') return getBrowserProvider();
  return null;
}

export function getActiveProvider() {
  if (_activeProvider) return _activeProvider;
  const savedId = getSavedWalletId();
  if (savedId) {
    const p = getProviderById(savedId);
    if (p) {
      _activeProvider = p;
      return p;
    }
  }
  // Auto-detect any available provider: Rabby -> OKX -> MetaMask -> general
  const detected = getRabbyProvider() || getOkxProvider() || getMetaMaskProvider() || getBrowserProvider();
  if (detected) _activeProvider = detected;
  return detected || null;
}

export function setActiveProvider(provider, walletId) {
  _activeProvider = provider;
  if (walletId) setSavedWalletId(walletId);
}

export function isDisconnected() {
  try { return localStorage.getItem(DISCONNECT_KEY) === '1'; } catch { return false; }
}

function setDisconnected(v) {
  try { v ? localStorage.setItem(DISCONNECT_KEY, '1') : localStorage.removeItem(DISCONNECT_KEY); } catch {}
}

export async function disconnectWallet() {
  setDisconnected(true);
  try {
    const provider = getActiveProvider();
    await provider?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  } catch {
    // Some wallets don't support revokePermissions; the local flag still disconnects
  }
}

/** Ensure the wallet is on the given chain, adding the network if needed. */
export async function ensureNetwork(chainKey = 'genlayer') {
  const provider = getActiveProvider();
  if (!provider) throw new Error('No Web3 wallet provider detected.');
  const net = NETWORKS[chainKey] || NETWORKS.genlayer;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainIdHex }] });
  } catch (err) {
    if (err && (err.code === 4902 || err.code === -32603 || /unrecognized|not found|add.*chain/i.test(err.message || ''))) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [net.params] });
    } else {
      throw err;
    }
  }
}

/** Connect wallet, switch to the given chain, return the checksum address. */
export async function connectWallet(chainKey = 'genlayer', walletId = null) {
  let provider;
  if (walletId) {
    provider = getProviderById(walletId);
    if (!provider) {
      const match = WALLETS.find((w) => w.id === walletId);
      throw new Error(`${match ? match.name : 'Wallet'} is not installed.`);
    }
  } else {
    provider = getActiveProvider();
    if (!provider) throw new Error('No Web3 wallet detected.');
  }

  setActiveProvider(provider, walletId);
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  setDisconnected(false);
  await ensureNetwork(chainKey);
  return accounts[0];
}

export async function getConnectedAddress() {
  if (isDisconnected()) return null;
  const provider = getActiveProvider();
  if (!provider) return null;
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts && accounts.length ? accounts[0] : null;
  } catch {
    return null;
  }
}

export function onWalletEvents({ onAccounts, onChain }) {
  const provider = getActiveProvider();
  if (!provider) return () => {};
  const a = (accs) => onAccounts?.(accs && accs.length ? accs[0] : null);
  const c = (cid) => onChain?.(cid);
  provider.on?.('accountsChanged', a);
  provider.on?.('chainChanged', c);
  return () => {
    provider.removeListener?.('accountsChanged', a);
    provider.removeListener?.('chainChanged', c);
  };
}
