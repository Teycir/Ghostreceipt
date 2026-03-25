import type { BitcoinProvider, ProviderConfig } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError } from '@/lib/security/secure-logging';
import {
  resolveProviderThrottlePolicy,
  waitForProviderThrottleSlot,
} from '@/lib/libraries/backend-core/providers/provider-throttle';

interface EsploraTxResponse {
  txid: string;
  vout: Array<{ value: number }>;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Blockstream Esplora provider (public, no API key required).
 */
export class BlockstreamProvider implements BitcoinProvider {
  readonly name = 'blockstream.info';
  readonly chain = 'bitcoin' as const;
  readonly config: ProviderConfig = {
    name: 'blockstream.info',
    priority: 2,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 60 / 60,
      requestsPerDay: 86400,
    },
  };

  private readonly baseUrl = 'https://blockstream.info/api';
  private readonly throttlePolicy = resolveProviderThrottlePolicy('blockstream');

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = BitcoinTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Bitcoin transaction hash: ${txHash}`);
    }

    const txUrl = `${this.baseUrl}/tx/${txHash}`;
    const txUrlValidation = validateUrl(txUrl);
    if (!txUrlValidation.valid) {
      throw new Error(`Blocked provider URL: ${txUrlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(
      this.throttlePolicy.scope,
      this.throttlePolicy.requestThrottleMs
    );

    const response = await fetch(txUrl, {
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

    const data = (await response.json()) as EsploraTxResponse;
    let currentTipHeight: number | undefined;
    if (data.status.confirmed) {
      currentTipHeight = await this.fetchCurrentBlockHeight(signal);
    }

    return this.normalize(data, currentTipHeight);
  }

  private normalize(data: EsploraTxResponse, currentTipHeight?: number): CanonicalTxData {
    const totalValue = data.vout.reduce((sum, output) => sum + output.value, 0);
    const confirmations = data.status.confirmed
      ? this.calculateConfirmations(data.status.block_height, currentTipHeight)
      : 0;
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

    await waitForProviderThrottleSlot(
      this.throttlePolicy.scope,
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
      throw new Error('Invalid block height response from blockstream.info');
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

      await waitForProviderThrottleSlot(
        this.throttlePolicy.scope,
        this.throttlePolicy.requestThrottleMs
      );

      const response = await fetch(healthUrl, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
