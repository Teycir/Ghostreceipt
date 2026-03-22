import type { BitcoinProvider, ProviderConfig } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';

/**
 * Mempool.space API response types
 */
interface MempoolTxResponse {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Mempool.space provider (public, no API key required)
 */
export class MempoolSpaceProvider implements BitcoinProvider {
  readonly name = 'mempool.space';
  readonly chain = 'bitcoin' as const;
  readonly config: ProviderConfig = {
    name: 'mempool.space',
    priority: 1,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerDay: 100000,
    },
  };

  private readonly baseUrl = 'https://mempool.space/api';

  async fetchTransaction(
    txHash: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    // Validate hash format
    const validationResult = BitcoinTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Bitcoin transaction hash: ${txHash}`);
    }

    const url = `${this.baseUrl}/tx/${txHash}`;
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    const response = await fetch(url, {
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
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as MempoolTxResponse;
    let currentTipHeight: number | undefined;
    if (data.status.confirmed) {
      currentTipHeight = await this.fetchCurrentBlockHeight(signal);
    }

    return this.normalize(data, currentTipHeight);
  }

  /**
   * Normalize mempool.space response to canonical format
   */
  private normalize(
    data: MempoolTxResponse,
    currentTipHeight?: number
  ): CanonicalTxData {
    // Design choice: we commit transaction total output value (includes change outputs).
    const totalValue = data.vout.reduce((sum, output) => sum + output.value, 0);

    // Get confirmations (0 if unconfirmed)
    const confirmations = data.status.confirmed
      ? this.calculateConfirmations(data.status.block_height, currentTipHeight)
      : 0;

    // Get timestamp (use block time if confirmed, otherwise current time)
    const timestampUnix = data.status.block_time || Math.floor(Date.now() / 1000);

    return {
      chain: 'bitcoin',
      txHash: data.txid,
      valueAtomic: totalValue.toString(),
      timestampUnix,
      confirmations,
      blockNumber: data.status.block_height,
      blockHash: data.status.block_hash,
    };
  }

  /**
   * Calculate confirmations from block height
   */
  private calculateConfirmations(
    blockHeight: number | undefined,
    currentTipHeight: number | undefined
  ): number {
    if (!blockHeight) {
      return 0;
    }

    if (typeof currentTipHeight !== 'number') {
      throw new Error('Missing current block height for confirmation calculation');
    }

    return Math.max(currentTipHeight - blockHeight + 1, 1);
  }

  private async fetchCurrentBlockHeight(signal?: AbortSignal): Promise<number> {
    const tipUrl = `${this.baseUrl}/blocks/tip/height`;
    const tipUrlValidation = validateUrl(tipUrl);
    if (!tipUrlValidation.valid) {
      throw new Error(`Blocked provider URL: ${tipUrlValidation.error ?? 'invalid URL'}`);
    }

    const response = await fetch(tipUrl, {
      method: 'GET',
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch current block height: HTTP ${response.status}`);
    }

    const rawBody = await response.text();
    const currentTipHeight = Number.parseInt(rawBody, 10);
    if (!Number.isFinite(currentTipHeight)) {
      throw new Error('Invalid block height response from mempool.space');
    }

    return currentTipHeight;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const healthUrl = `${this.baseUrl}/blocks/tip/height`;
      const urlValidation = validateUrl(healthUrl);
      if (!urlValidation.valid) {
        throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
      }

      const response = await fetch(healthUrl, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
