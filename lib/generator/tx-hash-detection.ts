import type { Chain, EthereumAsset } from '@/lib/generator/types';

const BITCOIN_TX_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const ETHEREUM_TX_HASH_PATTERN = /^0x[a-f0-9]{64}$/i;
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

export interface TxHashDetectionResult {
  chain: Chain;
  ethereumAsset: EthereumAsset;
  label: string;
}

export function detectChainFromTxHash(rawTxHash: string): TxHashDetectionResult | null {
  const txHash = rawTxHash.trim();
  if (!txHash) {
    return null;
  }

  if (ETHEREUM_TX_HASH_PATTERN.test(txHash)) {
    return {
      chain: 'ethereum',
      ethereumAsset: 'native',
      label: 'Ethereum transaction hash',
    };
  }

  if (BITCOIN_TX_HASH_PATTERN.test(txHash)) {
    return {
      chain: 'bitcoin',
      ethereumAsset: 'native',
      label: 'Bitcoin transaction hash',
    };
  }

  if (SOLANA_SIGNATURE_PATTERN.test(txHash)) {
    return {
      chain: 'solana',
      ethereumAsset: 'native',
      label: 'Solana transaction signature',
    };
  }

  return null;
}

export function isValidTxHashForChain(
  rawTxHash: string,
  chain: Chain
): boolean {
  const txHash = rawTxHash.trim();
  if (!txHash) {
    return false;
  }

  if (chain === 'bitcoin') {
    return BITCOIN_TX_HASH_PATTERN.test(txHash);
  }
  if (chain === 'ethereum') {
    return ETHEREUM_TX_HASH_PATTERN.test(txHash);
  }
  return SOLANA_SIGNATURE_PATTERN.test(txHash);
}

