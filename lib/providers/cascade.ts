import type {
  Provider,
  ProviderError,
  ProviderResult,
  CascadeConfig,
} from './types';
import type { CanonicalTxData } from '@/lib/validation/schemas';

/**
 * Provider cascade manager with immediate failover
 * Based on smartcontractpatternfinder pattern
 */
export class ProviderCascade {
  private providers: Provider[];
  private config: CascadeConfig;
  private activeRequests: Map<string, number>;

  constructor(providers: Provider[], config: CascadeConfig) {
    this.providers = this.shuffleProviders(providers);
    this.config = config;
    this.activeRequests = new Map();
  }

  /**
   * Shuffle providers on startup to distribute load
   */
  private shuffleProviders(providers: Provider[]): Provider[] {
    const shuffled = [...providers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
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
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      // Check capacity
      if (!this.hasCapacity(provider.name)) {
        console.warn(
          `[Cascade] Provider ${provider.name} at capacity, skipping`
        );
        continue;
      }

      try {
        this.incrementActive(provider.name);

        // Fetch with timeout
        const data = await this.fetchWithTimeout(provider, txHash);

        console.info(`[Cascade] Success with provider: ${provider.name}`);

        return {
          data,
          provider: provider.name,
          cached: false,
          fetchedAt: Date.now(),
        };
      } catch (error) {
        const providerError = this.normalizeError(error, provider.name);
        errors.push(providerError);
        lastError = providerError;

        console.warn(
          `[Cascade] Provider ${provider.name} failed: ${providerError.message}`
        );

        // Immediate failover - no delay for rate limits or errors
        if (providerError.retryable) {
          continue;
        }

        // Non-retryable error, stop cascade
        throw providerError;
      } finally {
        this.decrementActive(provider.name);
      }
    }

    // All providers failed
    throw new Error(
      `All providers failed. Last error: ${lastError?.message || 'Unknown'}`,
      { cause: lastError }
    );
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    provider: Provider,
    txHash: string
  ): Promise<CanonicalTxData> {
    return Promise.race([
      provider.fetchTransaction(txHash),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Provider ${provider.name} timeout after ${this.config.timeoutMs}ms`)),
          this.config.timeoutMs
        )
      ),
    ]);
  }

  /**
   * Normalize error to ProviderError
   */
  private normalizeError(error: unknown, providerName: string): ProviderError {
    if (this.isProviderError(error)) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    const providerError = new Error(message) as ProviderError;
    providerError.provider = providerName;
    providerError.code = 'PROVIDER_ERROR';
    providerError.retryable = true;

    // Check for rate limit indicators
    if (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('too many requests')
    ) {
      providerError.code = 'RATE_LIMIT';
      providerError.retryable = true;
    }

    // Check for timeout
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      providerError.code = 'TIMEOUT';
      providerError.retryable = true;
    }

    // Check for not found
    if (
      message.includes('not found') ||
      message.includes('404') ||
      message.includes('does not exist')
    ) {
      providerError.code = 'NOT_FOUND';
      providerError.retryable = false;
    }

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
