import { studionet } from 'genlayer-js/chains';

const CHAIN_ID_HEX = '0x' + studionet.id.toString(16); // 61999 -> 0xf1ef

export function hasMetaMask() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/** Ensure MetaMask is on studionet, adding the network if it isn't there yet. */
export async function ensureStudionet() {
  if (!hasMetaMask()) throw new Error('MetaMask not found');
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    // 4902 = chain not added; -32603 = internal (often also "unknown chain")
    if (err && (err.code === 4902 || err.code === -32603)) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: studionet.name,
            nativeCurrency: studionet.nativeCurrency,
            rpcUrls: studionet.rpcUrls.default.http,
            blockExplorerUrls: [studionet.blockExplorers?.default?.url].filter(Boolean),
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/** Connect MetaMask, switch to studionet, return the checksum address. */
export async function connectWallet() {
  if (!hasMetaMask()) throw new Error('MetaMask not found');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  await ensureStudionet();
  return accounts[0];
}

export async function getConnectedAddress() {
  if (!hasMetaMask()) return null;
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
