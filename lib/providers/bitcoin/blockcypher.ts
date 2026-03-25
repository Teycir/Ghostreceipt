import type {
  ApiKeyConfig,
  BitcoinProvider,
  ProviderConfig,
} from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { BitcoinTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError, secureWarn } from '@/lib/security/secure-logging';
import {
  ApiKeyCascade,
  type ApiKeyCascadeMetricsSnapshot,
} from '@/lib/libraries/backend-core/providers/api-key-cascade';
import {
  type ProviderThrottlePolicy,
  resetProviderThrottleStateForTests,
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

const BLOCKCYPHER_METRICS_SCOPE = 'provider:blockcypher';
const BLOCKCYPHER_KEY_ROTATION_ERROR_PATTERNS = [
  'rate limit',
  'too many requests',
  '429',
  '401',
  '403',
  'unauthorized',
  'forbidden',
  'invalid api key',
  'invalid token',
  'invalid api token',
  'api token invalid',
  'quota exceeded',
  'daily request count exceeded',
];

function shouldContinueBlockCypherKeyRotation(error: Error): boolean {
  const normalizedMessage = error.message.toLowerCase();
  return BLOCKCYPHER_KEY_ROTATION_ERROR_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern)
  );
}

/**
 * BlockCypher BTC provider.
 * Works keyless, or with optional API-token rotation for higher burst resilience.
 */
export class BlockCypherProvider implements BitcoinProvider {
  readonly name = 'blockcypher';
  readonly chain = 'bitcoin' as const;
  readonly config: ProviderConfig = {
    name: 'blockcypher',
    priority: 1,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 3,
      requestsPerDay: 2400,
    },
  };

  private baseUrl = 'https://api.blockcypher.com/v1/btc/main';
  private readonly keyCascade: ApiKeyCascade | null;
  private readonly throttlePolicy: ProviderThrottlePolicy;

  constructor(apiKeyConfig?: ApiKeyConfig) {
    this.keyCascade =
      apiKeyConfig && apiKeyConfig.keys.length > 0
        ? new ApiKeyCascade(apiKeyConfig, {
            metricsScope: BLOCKCYPHER_METRICS_SCOPE,
          })
        : null;
    this.throttlePolicy = resolveProviderThrottlePolicy('blockcypher', {
      hasApiKey: this.keyCascade !== null && this.keyCascade.size > 0,
    });
  }

  static getRuntimeMetrics(): ApiKeyCascadeMetricsSnapshot | null {
    return ApiKeyCascade.getMetricsSnapshot(BLOCKCYPHER_METRICS_SCOPE);
  }

  static resetRuntimeMetricsForTests(): void {
    ApiKeyCascade.resetMetricsForTests(BLOCKCYPHER_METRICS_SCOPE);
    resetProviderThrottleStateForTests(BLOCKCYPHER_METRICS_SCOPE);
  }

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = BitcoinTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Bitcoin transaction hash: ${txHash}`);
    }

    if (!this.keyCascade || this.keyCascade.size === 0) {
      return this.fetchWithToken(txHash, null, signal);
    }

    try {
      return await this.keyCascade.execute(
        async (apiToken) => this.fetchWithToken(txHash, apiToken, signal),
        {
          delayBetweenAttemptsMs: this.throttlePolicy.keyAttemptDelayMs,
          isNonRetryableError: (error) => {
            const normalizedMessage = error.message.toLowerCase();
            // Treat 429 as non-retryable in-key-cascade to avoid spike amplification
            // (fail over to public fallback instead of spraying all keys).
            return (
              normalizedMessage.includes('transaction not found') ||
              normalizedMessage.includes('invalid bitcoin transaction hash') ||
              normalizedMessage.includes('rate limit')
            );
          },
          shouldContinueToNextKey: (error) => shouldContinueBlockCypherKeyRotation(error),
          onAttemptFailure: (error, context) => {
            secureWarn(
              `[${this.name}] Key ${context.keyIndex + 1} failed (${error.message}), trying next key`
            );
          },
        }
      );
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Unknown error');
      if (normalizedError.message.startsWith('All API keys exhausted')) {
        secureError(`[${this.name}] API key pool exhausted`, BlockCypherProvider.getRuntimeMetrics());
        const causeMessage =
          normalizedError.cause instanceof Error
            ? normalizedError.cause.message
            : normalizedError.message;
        throw new Error(`All BlockCypher API keys exhausted. Last error: ${causeMessage}`, {
          cause: normalizedError.cause instanceof Error ? normalizedError.cause : normalizedError,
        });
      }
      throw normalizedError;
    }
  }

  private async fetchWithToken(
    txHash: string,
    apiToken: string | null,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    const url = this.buildTxUrl(txHash, apiToken);
    this.assertAllowedUrl(url);
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
      const apiToken =
        this.keyCascade && this.keyCascade.size > 0
          ? this.keyCascade.keys[0] ?? null
          : null;
      const url = this.buildHealthUrl(apiToken);
      this.assertAllowedUrl(url);
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

  private buildTxUrl(txHash: string, apiToken: string | null): string {
    const base = `${this.baseUrl}/txs/${txHash}`;
    if (!apiToken) {
      return base;
    }

    return `${base}?token=${encodeURIComponent(apiToken)}`;
  }

  private buildHealthUrl(apiToken: string | null): string {
    const base = this.baseUrl;
    if (!apiToken) {
      return base;
    }

    return `${base}?token=${encodeURIComponent(apiToken)}`;
  }

  private assertAllowedUrl(url: string): void {
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }
  }
}
