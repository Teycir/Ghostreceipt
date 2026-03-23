/**
 * lib/format/units.ts
 * Pure unit-conversion utilities for supported chains.
 * No React dependencies — safe to use anywhere (hooks, utils, tests).
 */

import type { Chain } from '@/lib/generator/types';

const SATS_PER_BTC = 1e8;
const WEI_PER_ETH = 1e18;

const CHAIN_CONFIG: Record<Chain, { divisor: number; symbol: string; atomicUnit: string } | null> = {
  bitcoin:  { divisor: SATS_PER_BTC, symbol: 'BTC',  atomicUnit: 'satoshis' },
  ethereum: { divisor: WEI_PER_ETH,  symbol: 'ETH',  atomicUnit: 'wei'      },
  solana:   null, // Solana support planned; no conversion implemented yet
};

/**
 * Returns a human-readable "≈ 1.00 BTC" label for a given atomic amount + chain.
 * Returns null if the amount is invalid or the chain has no conversion defined.
 */
export function formatAtomicAmount(amount: string, chain: Chain): string | null {
  const config = CHAIN_CONFIG[chain];
  if (!config) return null;

  const n = Number(amount);
  if (!amount || Number.isNaN(n) || n <= 0) return null;

  const human = n / config.divisor;
  const formatted = human.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return `≈ ${formatted} ${config.symbol}`;
}

/**
 * Returns just the human-readable amount string (no "≈" prefix).
 * E.g. "1.00000000 BTC"
 */
export function toHumanAmount(amount: string, chain: Chain): string {
  const config = CHAIN_CONFIG[chain];
  if (!config) return amount;

  const n = Number(amount);
  if (!amount || Number.isNaN(n) || n <= 0) return amount;

  const human = n / config.divisor;
  const formatted = human.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return `${formatted} ${config.symbol}`;
}

/**
 * Returns the atomic unit label for a given chain.
 * E.g. "satoshis" for bitcoin, "wei" for ethereum.
 */
export function atomicUnitLabel(chain: Chain): string {
  return CHAIN_CONFIG[chain]?.atomicUnit ?? 'units';
}

/**
 * Returns an example placeholder for the amount input.
 */
export function amountPlaceholder(chain: Chain): string {
  const config = CHAIN_CONFIG[chain];
  if (!config) return 'Enter amount';
  const exampleAtomic = config.divisor;
  return `e.g. ${exampleAtomic.toLocaleString()} (= 1 ${config.symbol})`;
}
