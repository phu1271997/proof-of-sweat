import React, { createContext, useContext, useMemo, useState } from 'react';
import { CHAINS } from './chains.js';
import * as gl from './genlayer.js';
import * as arc from './arcAdapter.js';

const ChainCtx = createContext(null);

function buildAdapter(key) {
  const meta = CHAINS[key];
  if (key === 'arc') {
    return {
      ...meta,
      configured: arc.arcConfigured,
      listBounties: arc.arcListBounties,
      getBounty: arc.arcGetBounty,
      getConfig: arc.arcGetConfig,
      getCredit: arc.arcGetCredit,
      getBalance: arc.arcGetBalance,
      fetchReputation: arc.arcFetchReputation,
      send: arc.arcSend,
    };
  }
  return {
    ...meta,
    configured: gl.contractConfigured,
    listBounties: gl.fetchBounties,
    getBounty: gl.fetchBounty,
    getConfig: gl.fetchConfig,
    getCredit: gl.fetchCredit,
    getBalance: gl.fetchNativeBalance,
    fetchReputation: gl.fetchReputation,
    send: gl.send,
  };
}

export function ChainProvider({ children }) {
  const [chainKey, setKey] = useState(() => {
    try { return localStorage.getItem('pos_chain') === 'arc' ? 'arc' : 'genlayer'; } catch { return 'genlayer'; }
  });
  const setChain = (k) => {
    try { localStorage.setItem('pos_chain', k); } catch {}
    setKey(k);
  };
  const adapter = useMemo(() => buildAdapter(chainKey), [chainKey]);
  const value = useMemo(() => ({ chainKey, setChain, adapter, chains: CHAINS }), [chainKey, adapter]);
  return <ChainCtx.Provider value={value}>{children}</ChainCtx.Provider>;
}

export function useChain() {
  const ctx = useContext(ChainCtx);
  if (!ctx) throw new Error('useChain must be used within ChainProvider');
  return ctx;
}
