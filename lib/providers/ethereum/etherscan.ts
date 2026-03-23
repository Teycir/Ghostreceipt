import type { EthereumProvider, ProviderConfig, ApiKeyConfig } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureWarn, secureError } from '@/lib/security/secure-logging';

/**
 * Etherscan proxy API response types
 */
interface EtherscanRpcError {
  code?: number;
  message?: string;
}

interface EtherscanProxyResponse<T> {
  jsonrpc?: string;
  id?: number | string | null;
  result?: T;
  error?: EtherscanRpcError;
  status?: string;
  message?: string;
}

interface EtherscanProxyTransaction {
  hash?: string;
  value?: string;
  blockNumber?: string | null;
}

interface EtherscanProxyReceipt {
  blockNumber?: string | null;
  status?: string;
}

interface EtherscanProxyBlock {
  timestamp?: string;
}

const ETHEREUM_CHAIN_ID = '1';
const HEX_QUANTITY_REGEX = /^0x[0-9a-f]+$/i;

/**
 * Etherscan provider with API key cascade
 */
export class EtherscanProvider implements EthereumProvider {
  readonly name = 'etherscan';
  readonly chain = 'ethereum' as const;
  readonly config: ProviderConfig = {
    name: 'etherscan',
    priority: 1,
    requiresApiKey: true,
    rateLimit: {
      requestsPerSecond: 5,
      requestsPerDay: 100000,
    },
  };

  private readonly baseUrl = 'https://api.etherscan.io/v2/api';
  private apiKeys: string[];
  private currentKeyIndex: number;
  private readonly rotationStrategy: ApiKeyConfig['rotationStrategy'];
  private keyUsageCounts: number[];

  constructor(apiKeyConfig: ApiKeyConfig) {
    this.apiKeys = this.shuffleKeys(apiKeyConfig);
    this.currentKeyIndex = 0;
    this.rotationStrategy = apiKeyConfig.rotationStrategy;
    this.keyUsageCounts = new Array(this.apiKeys.length).fill(0);
  }

  /**
   * Shuffle API keys on startup to distribute load
   */
  private shuffleKeys(config: ApiKeyConfig): string[] {
    if (!config.shuffleOnStartup) {
      return config.keys;
    }

    const shuffled = [...config.keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  private buildKeyAttemptOrder(): number[] {
    if (this.apiKeys.length === 0) {
      return [];
    }

    if (this.rotationStrategy === 'least-used') {
      return this.apiKeys
        .map((_, index) => index)
        .sort((a, b) => {
          const usageDelta = this.keyUsageCounts[a]! - this.keyUsageCounts[b]!;
          if (usageDelta !== 0) {
            return usageDelta;
          }
          return a - b;
        });
    }

    let startIndex = 0;
    if (this.rotationStrategy === 'random') {
      startIndex = Math.floor(Math.random() * this.apiKeys.length);
    } else {
      startIndex = this.currentKeyIndex;
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    }

    const order: number[] = [];
    for (let offset = 0; offset < this.apiKeys.length; offset++) {
      order.push((startIndex + offset) % this.apiKeys.length);
    }
    return order;
  }

  async fetchTransaction(
    txHash: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    // Validate hash format
    const validationResult = EthereumTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Ethereum transaction hash: ${txHash}`);
    }

    // Try each API key
    let lastError: Error | null = null;

    const keyAttemptOrder = this.buildKeyAttemptOrder();

    for (let attempt = 0; attempt < keyAttemptOrder.length; attempt++) {
      if (attempt > 0) {
        await this.delay(50);
      }

      const keyIndex = keyAttemptOrder[attempt]!;
      const apiKey = this.apiKeys[keyIndex];
      if (!apiKey) {
        throw new Error('No API keys available');
      }

      try {
        this.keyUsageCounts[keyIndex] = (this.keyUsageCounts[keyIndex] ?? 0) + 1;
        return await this.fetchWithKey(txHash, apiKey, signal);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        const normalizedMessage = lastError.message.toLowerCase();

        // Non-retryable transaction-level failures should stop key cascade immediately.
        if (
          normalizedMessage.includes('transaction not found') ||
          normalizedMessage.includes('transaction reverted') ||
          normalizedMessage.includes('invalid ethereum transaction hash')
        ) {
          throw lastError;
        }

        secureWarn(
          `[${this.name}] Key ${keyIndex + 1} failed (${lastError.message}), trying next key`
        );
        continue;
      }
    }

    // All keys exhausted
    throw new Error(
      `All Etherscan API keys exhausted. Last error: ${lastError?.message || 'Unknown'}`,
      { cause: lastError }
    );
  }

  /**
   * Fetch transaction with specific API key
   */
  private async fetchWithKey(
    txHash: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    const tx = await this.requestProxy<EtherscanProxyTransaction | null>(
      'eth_getTransactionByHash',
      apiKey,
      { txhash: txHash },
      signal
    );

    if (!tx) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    if (
      typeof tx.hash !== 'string' ||
      typeof tx.value !== 'string' ||
      typeof tx.blockNumber !== 'string'
    ) {
      throw new Error('Malformed Etherscan transaction payload');
    }

    const receipt = await this.requestProxy<EtherscanProxyReceipt | null>(
      'eth_getTransactionReceipt',
      apiKey,
      { txhash: txHash },
      signal
    );

    if (!receipt || typeof receipt.blockNumber !== 'string') {
      throw new Error(`Transaction receipt unavailable: ${txHash}`);
    }

    if (receipt.status?.toLowerCase() === '0x0') {
      const revertedError = new Error(`Transaction reverted: ${txHash}`) as Error & {
        provider?: string;
        code?: string;
        retryable?: boolean;
      };
      revertedError.provider = this.name;
      revertedError.code = 'REVERTED';
      revertedError.retryable = false;
      throw revertedError;
    }

    const currentBlockHex = await this.requestProxy<string>(
      'eth_blockNumber',
      apiKey,
      {},
      signal
    );
    const currentBlockNumber = this.hexToNumber(currentBlockHex, 'block number');

    const block = await this.requestProxy<EtherscanProxyBlock | null>(
      'eth_getBlockByNumber',
      apiKey,
      { tag: tx.blockNumber, boolean: 'false' },
      signal
    );

    if (!block || typeof block.timestamp !== 'string') {
      throw new Error(`Block details unavailable for transaction: ${txHash}`);
    }

    return this.normalize({
      txHash: tx.hash,
      valueHex: tx.value,
      blockNumberHex: tx.blockNumber,
      timestampHex: block.timestamp,
      currentBlockNumber,
    });
  }

  /**
   * Perform a single Etherscan proxy request with strict response handling.
   */
  private async requestProxy<T>(
    action: string,
    apiKey: string,
    params: Record<string, string>,
    signal?: AbortSignal
  ): Promise<T> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('chainid', ETHEREUM_CHAIN_ID);
    url.searchParams.set('module', 'proxy');
    url.searchParams.set('action', action);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set('apikey', apiKey);

    const urlValue = url.toString();
    const urlValidation = validateUrl(urlValue);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    const response = await fetch(urlValue, {
      method: 'GET',
      signal: signal ?? null,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid JSON response from Etherscan');
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Malformed Etherscan response');
    }

    const payload = data as EtherscanProxyResponse<T>;
    const statusMessage = typeof payload.message === 'string' ? payload.message : 'Unknown error';
    const normalizedStatusMessage = statusMessage.toLowerCase();

    if (payload.status === '0') {
      if (normalizedStatusMessage.includes('rate limit')) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Etherscan error: ${statusMessage}`);
    }

    if (payload.error && typeof payload.error === 'object') {
      const rpcMessage =
        typeof payload.error.message === 'string'
          ? payload.error.message
          : 'Unknown RPC error';
      if (rpcMessage.toLowerCase().includes('rate limit')) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Etherscan RPC error: ${rpcMessage}`);
    }

    if (!('result' in payload)) {
      throw new Error('Malformed Etherscan response: missing result');
    }

    return payload.result as T;
  }

  private hexToBigInt(value: string, fieldName: string): bigint {
    if (!HEX_QUANTITY_REGEX.test(value)) {
      throw new Error(`Malformed ${fieldName} value from Etherscan`);
    }

    try {
      return BigInt(value);
    } catch {
      throw new Error(`Invalid ${fieldName} value from Etherscan`);
    }
  }

  private hexToNumber(value: string, fieldName: string): number {
    const asBigInt = this.hexToBigInt(value, fieldName);
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`${fieldName} exceeds safe integer range`);
    }
    return Number(asBigInt);
  }

  /**
   * Normalize Etherscan proxy response to canonical format
   */
  private normalize(data: {
    txHash: string;
    valueHex: string;
    blockNumberHex: string;
    timestampHex: string;
    currentBlockNumber: number;
  }): CanonicalTxData {
    const blockNumber = this.hexToNumber(data.blockNumberHex, 'transaction block number');
    const timestampUnix = this.hexToNumber(data.timestampHex, 'block timestamp');
    const valueAtomic = this.hexToBigInt(data.valueHex, 'transaction value').toString();
    const confirmations = Math.max(data.currentBlockNumber - blockNumber + 1, 1);

    return {
      chain: 'ethereum',
      txHash: data.txHash,
      valueAtomic,
      timestampUnix,
      confirmations,
      blockNumber,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.apiKeys[0];
      if (!apiKey) {
        return false;
      }

      const blockNumberHex = await this.requestProxy<string>(
        'eth_blockNumber',
        apiKey,
        {}
      );

      return HEX_QUANTITY_REGEX.test(blockNumberHex);
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
