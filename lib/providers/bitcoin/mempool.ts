import type { BitcoinProvider, ProviderConfig } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';

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

    return this.normalize(data);
  }

  /**
   * Normalize mempool.space response to canonical format
   */
  private normalize(data: MempoolTxResponse): CanonicalTxData {
    // Calculate total output value (in satoshis)
    const totalValue = data.vout.reduce((sum, output) => sum + output.value, 0);

    // Get confirmations (0 if unconfirmed)
    const confirmations = data.status.confirmed
      ? this.calculateConfirmations(data.status.block_height)
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
  private calculateConfirmations(blockHeight: number | undefined): number {
    if (!blockHeight) {
      return 0;
    }

    // Note: In production, fetch current block height from mempool.space
    // For now, return a placeholder
    // TODO: Implement current block height fetching
    return 1;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/blocks/tip/height`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
