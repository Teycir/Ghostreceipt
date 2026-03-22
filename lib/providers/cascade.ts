import type {
  Provider,
  ProviderError,
  ProviderResult,
  CascadeConfig,
} from './types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { secureWarn, secureInfo } from '@/lib/security/secure-logging';

/**
 * Provider cascade manager with immediate failover
 * Based on smartcontractpatternfinder pattern
 */
export class ProviderCascade {
  private providers: Provider[];
  private config: CascadeConfig;
  private activeRequests: Map<string, number>;

  constructor(providers: Provider[], config: CascadeConfig) {
    this.providers = this.orderProviders(providers);
    this.config = config;
    this.activeRequests = new Map();
  }

  /**
   * Order providers by priority; shuffle only within equal-priority groups.
   */
  private orderProviders(providers: Provider[]): Provider[] {
    const buckets = new Map<number, Provider[]>();
    for (const provider of providers) {
      const priority = provider.config.priority;
      const bucket = buckets.get(priority) ?? [];
      bucket.push(provider);
      buckets.set(priority, bucket);
    }

    const priorities = Array.from(buckets.keys()).sort((a, b) => a - b);
    const ordered: Provider[] = [];

    for (const priority of priorities) {
      const bucket = buckets.get(priority) ?? [];
      const shuffledBucket = [...bucket];

      for (let i = shuffledBucket.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledBucket[i], shuffledBucket[j]] = [shuffledBucket[j]!, shuffledBucket[i]!];
      }

      ordered.push(...shuffledBucket);
    }

    return ordered;
  }

  /**
   * Check if provider has capacity (bounded concurrency)
   */
  private hasCapacity(providerName: string): boolean {
    const active = this.activeRequests.get(providerName) || 0;
    return active < this.config.concurrencyLimit;
  }

  /**
   * Increment active request count
   */
  private incrementActive(providerName: string): void {
    const current = this.activeRequests.get(providerName) || 0;
    this.activeRequests.set(providerName, current + 1);
  }

  /**
   * Decrement active request count
   */
  private decrementActive(providerName: string): void {
    const current = this.activeRequests.get(providerName) || 0;
    this.activeRequests.set(providerName, Math.max(0, current - 1));
  }

  /**
   * Fetch transaction with cascade failover
   */
  async fetchTransaction(
    txHash: string
  ): Promise<ProviderResult<CanonicalTxData>> {
    const errors: ProviderError[] = [];
    let lastError: ProviderError | null = null;
    const maxAttempts = Math.max(1, this.config.maxRetries + 1);

    for (const provider of this.providers) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (!this.hasCapacity(provider.name)) {
          secureWarn(
            `[Cascade] Provider ${provider.name} at capacity, skipping`
          );
          break;
        }

        this.incrementActive(provider.name);
        let providerError: ProviderError | null = null;

        try {
          // Fetch with timeout
          const data = await this.fetchWithTimeout(provider, txHash);

          secureInfo(`[Cascade] Success with provider: ${provider.name}`);

          return {
            data,
            provider: provider.name,
            cached: false,
            fetchedAt: Date.now(),
          };
        } catch (error) {
          providerError = this.normalizeError(error, provider.name);
          errors.push(providerError);
          lastError = providerError;

          secureWarn(
            `[Cascade] Provider ${provider.name} failed (attempt ${attempt}/${maxAttempts}): ${providerError.message}`
          );
        } finally {
          this.decrementActive(provider.name);
        }

        if (!providerError) {
          break;
        }

        // Let other providers confirm missing transactions before failing.
        if (providerError.code === 'NOT_FOUND') {
          break;
        }

        // Rate-limited providers should fail over immediately to the next provider.
        if (providerError.code === 'RATE_LIMIT') {
          break;
        }

        // Non-retryable error, stop cascade immediately.
        if (!providerError.retryable) {
          throw providerError;
        }

        // Retryable error but no retries left, fail over to next provider.
        if (attempt === maxAttempts) {
          break;
        }

        if (this.config.retryDelayMs > 0) {
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    if (errors.length > 0 && errors.every((error) => error.code === 'NOT_FOUND')) {
      throw this.createProviderError(
        'Transaction not found in any provider',
        'cascade',
        'NOT_FOUND',
        false
      );
    }

    if (lastError) {
      // Preserve provider-specific metadata so route-level mapping can respond accurately.
      throw lastError;
    }

    throw this.createProviderError(
      'No provider could accept the request (all providers unavailable or at capacity)',
      'cascade',
      'PROVIDER_ERROR',
      true
    );
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    provider: Provider,
    txHash: string
  ): Promise<CanonicalTxData> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            `Provider ${provider.name} timeout after ${this.config.timeoutMs}ms`
          )
        );
      }, this.config.timeoutMs);
    });

    try {
      return await Promise.race([
        provider.fetchTransaction(txHash, controller.signal),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Normalize error to ProviderError
   */
  private normalizeError(error: unknown, providerName: string): ProviderError {
    if (this.isProviderError(error)) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    const normalizedMessage = message.toLowerCase();
    const providerError = this.createProviderError(
      message,
      providerName,
      'PROVIDER_ERROR',
      true
    );

    // Check for rate limit indicators
    if (
      normalizedMessage.includes('rate limit') ||
      normalizedMessage.includes('429') ||
      normalizedMessage.includes('too many requests')
    ) {
      providerError.code = 'RATE_LIMIT';
      providerError.retryable = true;
    }

    // Check for timeout
    if (
      normalizedMessage.includes('timeout') ||
      normalizedMessage.includes('etimedout')
    ) {
      providerError.code = 'TIMEOUT';
      providerError.retryable = true;
    }

    // Check for not found
    if (
      normalizedMessage.includes('not found') ||
      normalizedMessage.includes('404') ||
      normalizedMessage.includes('does not exist')
    ) {
      providerError.code = 'NOT_FOUND';
      providerError.retryable = false;
    }

    return providerError;
  }

  private createProviderError(
    message: string,
    providerName: string,
    code: string,
    retryable: boolean
  ): ProviderError {
    const providerError = new Error(message) as ProviderError;
    providerError.provider = providerName;
    providerError.code = code;
    providerError.retryable = retryable;
    return providerError;
  }

  /**
   * Type guard for ProviderError
   */
  private isProviderError(error: unknown): error is ProviderError {
    return (
      error instanceof Error &&
      'provider' in error &&
      'code' in error &&
      'retryable' in error
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get provider statistics
   */
  getStats(): Record<string, { active: number; name: string }> {
    const stats: Record<string, { active: number; name: string }> = {};
    for (const provider of this.providers) {
      stats[provider.name] = {
        name: provider.name,
        active: this.activeRequests.get(provider.name) || 0,
      };
    }
    return stats;
  }
}
