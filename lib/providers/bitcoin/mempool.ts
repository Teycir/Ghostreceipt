import type { BitcoinProvider, ProviderConfig } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError } from '@/lib/security/secure-logging';
import {
  resolveProviderThrottlePolicy,
  waitForProviderThrottleSlot,
} from '@/lib/libraries/backend-core/providers/provider-throttle';

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
    priority: 2,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 200 / 60,
      requestsPerDay: 288000,
    },
  };

  private readonly baseUrls: string[];
  private readonly throttlePolicy = resolveProviderThrottlePolicy('mempool.space');

  constructor() {
    this.baseUrls = this.resolveBaseUrls();
  }

  async fetchTransaction(
    txHash: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    // Validate hash format
    const validationResult = BitcoinTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Bitcoin transaction hash: ${txHash}`);
    }

    const errors: string[] = [];
    const endpointErrors: Error[] = [];

    for (const baseUrl of this.baseUrls) {
      try {
        return await this.fetchTransactionFromBaseUrl(baseUrl, txHash, signal);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        endpointErrors.push(normalized);
        errors.push(`${baseUrl} -> ${normalized.message}`);
      }
    }

    if (endpointErrors.length > 0 && endpointErrors.every((error) => this.isNotFoundError(error))) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    throw new Error(`Bitcoin public RPC endpoints failed: ${errors.join(' | ')}`);
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

  private async fetchCurrentBlockHeight(baseUrl: string, signal?: AbortSignal): Promise<number> {
    const tipUrl = `${baseUrl}/blocks/tip/height`;
    const tipUrlValidation = validateUrl(tipUrl);
    if (!tipUrlValidation.valid) {
      throw new Error(`Blocked provider URL: ${tipUrlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(
      `${this.throttlePolicy.scope}:${baseUrl}`,
      this.throttlePolicy.requestThrottleMs
    );

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
    for (const baseUrl of this.baseUrls) {
      try {
        const healthUrl = `${baseUrl}/blocks/tip/height`;
        const urlValidation = validateUrl(healthUrl);
        if (!urlValidation.valid) {
          throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
        }

        await waitForProviderThrottleSlot(
          `${this.throttlePolicy.scope}:${baseUrl}`,
          this.throttlePolicy.requestThrottleMs
        );

        const response = await fetch(healthUrl, {
          method: 'GET',
        });
        if (response.ok) {
          return true;
        }
      } catch (error) {
        secureError(`[${this.name}] Health check failed for ${baseUrl}:`, error);
      }
    }

    return false;
  }

  private async fetchTransactionFromBaseUrl(
    baseUrl: string,
    txHash: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    const url = `${baseUrl}/tx/${txHash}`;
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(
      `${this.throttlePolicy.scope}:${baseUrl}`,
      this.throttlePolicy.requestThrottleMs
    );

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
      currentTipHeight = await this.fetchCurrentBlockHeight(baseUrl, signal);
    }

    return this.normalize(data, currentTipHeight);
  }

  private resolveBaseUrls(): string[] {
    const listFromEnv = this.parseListEnv('BITCOIN_PUBLIC_RPC_URLS');
    const singleFromEnv = process.env['BITCOIN_PUBLIC_RPC_URL']?.trim() ?? '';
    const defaultBaseUrls = ['https://mempool.space/api'];

    return Array.from(
      new Set([
        ...listFromEnv,
        singleFromEnv,
        ...defaultBaseUrls,
      ].map((value) => value.trim()).filter((value) => value.length > 0))
    );
  }

  private parseListEnv(envKey: string): string[] {
    const raw = process.env[envKey]?.trim() ?? '';
    if (!raw) {
      return [];
    }

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private isNotFoundError(error: Error): boolean {
    return error.message.toLowerCase().includes('transaction not found');
  }
}
