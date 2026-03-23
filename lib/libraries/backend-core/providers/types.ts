import type { Chain, CanonicalTxData } from '@/lib/validation/schemas';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: string;
  priority: number;
  requiresApiKey: boolean;
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerDay: number;
  };
}

/**
 * Provider result with metadata
 */
export interface ProviderResult<T> {
  data: T;
  provider: string;
  cached: boolean;
  fetchedAt: number;
}

/**
 * Provider error with context
 */
export interface ProviderError extends Error {
  provider: string;
  code: string;
  retryable: boolean;
  statusCode?: number;
}

/**
 * Base provider interface
 */
export interface Provider {
  readonly name: string;
  readonly chain: Chain;
  readonly config: ProviderConfig;

  /**
   * Fetch transaction data
   */
  fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData>;

  /**
   * Health check
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Bitcoin provider interface
 */
export interface BitcoinProvider extends Provider {
  chain: 'bitcoin';
}

/**
 * Ethereum provider interface
 */
export interface EthereumProvider extends Provider {
  chain: 'ethereum';
}

/**
 * Solana provider interface
 */
export interface SolanaProvider extends Provider {
  chain: 'solana';
}

/**
 * Provider cascade manager configuration
 */
export interface CascadeConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  concurrencyLimit: number;
}

/**
 * API key configuration
 */
export interface ApiKeyConfig {
  keys: string[];
  rotationStrategy: 'round-robin' | 'random' | 'least-used';
  shuffleOnStartup: boolean;
}
