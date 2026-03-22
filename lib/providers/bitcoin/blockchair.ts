import type { BitcoinProvider, ProviderConfig } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';

interface BlockchairTransaction {
  block_id: number;
  hash: string;
  time: string;
  output_total: number;
}

interface BlockchairDashboardData {
  transaction: BlockchairTransaction;
}

interface BlockchairContext {
  code: number;
  state?: number;
  error?: string;
}

interface BlockchairResponse {
  data: Record<string, BlockchairDashboardData> | null;
  context: BlockchairContext;
}

interface BlockchairProviderOptions {
  apiKey?: string;
}

/**
 * Blockchair Bitcoin provider (API key optional, recommended for reliability).
 */
export class BlockchairProvider implements BitcoinProvider {
  readonly name = 'blockchair';
  readonly chain = 'bitcoin' as const;
  readonly config: ProviderConfig = {
    name: 'blockchair',
    priority: 2,
    requiresApiKey: false,
  };

  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.blockchair.com/bitcoin';

  constructor(options?: BlockchairProviderOptions) {
    this.apiKey = options?.apiKey;
  }

  async fetchTransaction(
    txHash: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    const validationResult = BitcoinTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Bitcoin transaction hash: ${txHash}`);
    }

    const url = new URL(`${this.baseUrl}/dashboards/transaction/${txHash}`);
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    const urlValidation = validateUrl(url.toString());
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: signal ?? null,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Transaction not found: ${txHash}`);
      }
      if (response.status === 429 || response.status === 430) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = (await response.json()) as BlockchairResponse;
    return this.normalize(txHash, payload);
  }

  private normalize(txHash: string, payload: BlockchairResponse): CanonicalTxData {
    if (payload.context.code === 404) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    if (
      payload.context.code === 429 ||
      payload.context.code === 430 ||
      payload.context.error?.toLowerCase().includes('blacklisted')
    ) {
      throw new Error('Rate limit exceeded');
    }

    if (!payload.data || !payload.data[txHash]) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    const transaction = payload.data[txHash].transaction;
    const blockId = transaction.block_id;
    const timestampUnix = this.parseUtcTimestamp(transaction.time);
    const confirmations =
      blockId > 0 && typeof payload.context.state === 'number'
        ? Math.max(payload.context.state - blockId + 1, 0)
        : 0;

    return {
      chain: 'bitcoin',
      txHash: transaction.hash,
      valueAtomic: transaction.output_total.toString(),
      timestampUnix,
      confirmations,
      blockNumber: blockId > 0 ? blockId : undefined,
      blockHash: undefined,
    };
  }

  private parseUtcTimestamp(timestamp: string): number {
    const parsed = Date.parse(timestamp.replace(' ', 'T') + 'Z');
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid transaction timestamp: ${timestamp}`);
    }
    return Math.floor(parsed / 1000);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const healthUrl = new URL(`${this.baseUrl}/stats`);
      if (this.apiKey) {
        healthUrl.searchParams.set('key', this.apiKey);
      }

      const urlValidation = validateUrl(healthUrl.toString());
      if (!urlValidation.valid) {
        throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
      }

      const response = await fetch(healthUrl.toString(), { method: 'GET' });
      return response.ok;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
