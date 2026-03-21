import type { EthereumProvider, ProviderConfig, ApiKeyConfig } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';

/**
 * Etherscan API response types
 */
interface EtherscanTxResponse {
  status: string;
  message: string;
  result: {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    isError: string;
    txreceipt_status: string;
    confirmations: string;
  };
}

/**
 * Etherscan provider with API key cascade
 */
export class EtherscanProvider implements EthereumProvider {
  readonly name = 'etherscan';
  readonly chain = 'ethereum' as const;
  readonly config: ProviderConfig = {
    name: 'etherscan',
    priority: 2,
    requiresApiKey: true,
    rateLimit: {
      requestsPerSecond: 5,
      requestsPerDay: 100000,
    },
  };

  private readonly baseUrl = 'https://api.etherscan.io/api';
  private apiKeys: string[];
  private currentKeyIndex: number;

  constructor(apiKeyConfig: ApiKeyConfig) {
    this.apiKeys = this.shuffleKeys(apiKeyConfig);
    this.currentKeyIndex = 0;
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

  /**
   * Get next API key (round-robin)
   */
  private getNextKey(): string {
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    
    if (!key) {
      throw new Error('No API keys available');
    }
    
    return key;
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

    for (let i = 0; i < this.apiKeys.length; i++) {
      const apiKey = this.getNextKey();

      try {
        const data = await this.fetchWithKey(txHash, apiKey, signal);
        return this.normalize(data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // If rate limited, try next key immediately
        if (lastError.message.toLowerCase().includes('rate limit')) {
          console.warn(`[${this.name}] Rate limited on key ${i + 1}, trying next`);
          continue;
        }

        // Non-retryable error, throw immediately
        throw lastError;
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
  ): Promise<EtherscanTxResponse['result']> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('module', 'proxy');
    url.searchParams.set('action', 'eth_getTransactionByHash');
    url.searchParams.set('txhash', txHash);
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
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as EtherscanTxResponse;

    if (data.status === '0') {
      if (data.message.toLowerCase().includes('rate limit')) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Etherscan error: ${data.message}`);
    }

    if (!data.result) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    return data.result;
  }

  /**
   * Normalize Etherscan response to canonical format
   */
  private normalize(data: EtherscanTxResponse['result']): CanonicalTxData {
    return {
      chain: 'ethereum',
      txHash: data.hash,
      valueAtomic: data.value, // Wei as string
      timestampUnix: parseInt(data.timeStamp, 10),
      confirmations: parseInt(data.confirmations, 10),
      blockNumber: parseInt(data.blockNumber, 10),
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.apiKeys[0];
      if (!apiKey) {
        return false;
      }

      const url = new URL(this.baseUrl);
      url.searchParams.set('module', 'proxy');
      url.searchParams.set('action', 'eth_blockNumber');
      url.searchParams.set('apikey', apiKey);
      const urlValue = url.toString();
      const urlValidation = validateUrl(urlValue);
      if (!urlValidation.valid) {
        throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
      }

      const response = await fetch(urlValue, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
