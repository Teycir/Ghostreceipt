import type { BitcoinProvider, ProviderConfig } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError } from '@/lib/security/secure-logging';
import {
  resolveProviderThrottlePolicy,
  waitForProviderThrottleSlot,
} from '@/lib/libraries/backend-core/providers/provider-throttle';

interface BlockCypherOutput {
  value?: number;
}

interface BlockCypherTxResponse {
  hash: string;
  total?: number;
  outputs?: BlockCypherOutput[];
  confirmations?: number;
  confirmed?: string;
  received?: string;
  block_height?: number;
  block_hash?: string;
}

/**
 * BlockCypher BTC provider (free-tier API, no key required for baseline usage).
 */
export class BlockCypherProvider implements BitcoinProvider {
  readonly name = 'blockcypher';
  readonly chain = 'bitcoin' as const;
  readonly config: ProviderConfig = {
    name: 'blockcypher',
    priority: 2,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 3,
      requestsPerDay: 2400,
    },
  };

  private readonly baseUrl = 'https://api.blockcypher.com/v1/btc/main/txs';
  private readonly throttlePolicy = resolveProviderThrottlePolicy('blockcypher');

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = BitcoinTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Bitcoin transaction hash: ${txHash}`);
    }

    const url = `${this.baseUrl}/${txHash}`;
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(
      this.throttlePolicy.scope,
      this.throttlePolicy.requestThrottleMs
    );

    const response = await fetch(url, {
      method: 'GET',
      signal: signal ?? null,
      headers: {
        Accept: 'application/json',
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

    const payload = (await response.json()) as BlockCypherTxResponse;
    return this.normalize(payload);
  }

  private normalize(payload: BlockCypherTxResponse): CanonicalTxData {
    const valueAtomic =
      payload.total ??
      (payload.outputs ?? []).reduce((sum, output) => sum + (output.value ?? 0), 0);

    const timestampUnix = this.resolveTimestampUnix(payload);
    const confirmations = Math.max(0, payload.confirmations ?? 0);

    return {
      chain: 'bitcoin',
      txHash: payload.hash,
      valueAtomic: valueAtomic.toString(),
      timestampUnix,
      confirmations,
      blockNumber:
        typeof payload.block_height === 'number' && payload.block_height > 0
          ? payload.block_height
          : undefined,
      blockHash: payload.block_hash,
    };
  }

  private resolveTimestampUnix(payload: BlockCypherTxResponse): number {
    const timestampSource = payload.confirmed ?? payload.received;
    if (!timestampSource) {
      return Math.floor(Date.now() / 1000);
    }

    const parsed = Date.parse(timestampSource);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid transaction timestamp: ${timestampSource}`);
    }

    return Math.floor(parsed / 1000);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const url = 'https://api.blockcypher.com/v1/btc/main';
      const urlValidation = validateUrl(url);
      if (!urlValidation.valid) {
        throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
      }

      await waitForProviderThrottleSlot(
        this.throttlePolicy.scope,
        this.throttlePolicy.requestThrottleMs
      );

      const response = await fetch(url, { method: 'GET' });
      return response.ok;
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
