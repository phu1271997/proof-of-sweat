import { useMemo } from 'react';
import { createTransactionKit } from '@genlayer/transaction-kit';
import { studioNext } from './genlayer.js';

export function useTransactionKit(address) {
  return useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum || !address || !address.startsWith('0x')) {
      return null;
    }
    try {
      return createTransactionKit({
        chain: studioNext,
        provider: window.ethereum,
        account: address,
      });
    } catch (e) {
      console.error('Error creating transaction kit:', e);
      return null;
    }
  }, [address]);
}
