import type { ApiKeyConfig } from './types';

export interface ApiKeyCascadeExecutionContext {
  keyIndex: number;
  attempt: number;
}

export interface ApiKeyCascadeExecuteOptions {
  delayBetweenAttemptsMs?: number;
  isNonRetryableError?: (error: Error) => boolean;
  onAttemptFailure?: (error: Error, context: ApiKeyCascadeExecutionContext) => void;
}

/**
 * Provider-agnostic API key rotation + failover utility.
 * Can be reused by any API integration that needs a key pool.
 */
export class ApiKeyCascade {
  private readonly apiKeys: string[];
  private readonly rotationStrategy: ApiKeyConfig['rotationStrategy'];
  private currentKeyIndex: number;
  private readonly keyUsageCounts: number[];

  constructor(config: ApiKeyConfig) {
    this.apiKeys = ApiKeyCascade.shuffleKeys(config);
    this.rotationStrategy = config.rotationStrategy;
    this.currentKeyIndex = 0;
    this.keyUsageCounts = new Array(this.apiKeys.length).fill(0);
  }

  get size(): number {
    return this.apiKeys.length;
  }

  get keys(): readonly string[] {
    return this.apiKeys;
  }

  private static shuffleKeys(config: ApiKeyConfig): string[] {
    if (!config.shuffleOnStartup) {
      return [...config.keys];
    }

    const shuffled = [...config.keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    return shuffled;
  }

  private buildAttemptOrder(): number[] {
    if (this.apiKeys.length === 0) {
      return [];
    }

    if (this.rotationStrategy === 'least-used') {
      return this.apiKeys
        .map((_, index) => index)
        .sort((a, b) => {
          const usageDelta = this.keyUsageCounts[a]! - this.keyUsageCounts[b]!;
          if (usageDelta !== 0) {
            return usageDelta;
          }
          return a - b;
        });
    }

    let startIndex = 0;
    if (this.rotationStrategy === 'random') {
      startIndex = Math.floor(Math.random() * this.apiKeys.length);
    } else {
      startIndex = this.currentKeyIndex;
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    }

    const order: number[] = [];
    for (let offset = 0; offset < this.apiKeys.length; offset++) {
      order.push((startIndex + offset) % this.apiKeys.length);
    }

    return order;
  }

  async execute<T>(
    runner: (apiKey: string, context: ApiKeyCascadeExecutionContext) => Promise<T>,
    options: ApiKeyCascadeExecuteOptions = {}
  ): Promise<T> {
    const order = this.buildAttemptOrder();
    if (order.length === 0) {
      throw new Error('No API keys available');
    }

    const {
      delayBetweenAttemptsMs = 50,
      isNonRetryableError,
      onAttemptFailure,
    } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < order.length; attempt++) {
      if (attempt > 0 && delayBetweenAttemptsMs > 0) {
        await this.delay(delayBetweenAttemptsMs);
      }

      const keyIndex = order[attempt]!;
      const apiKey = this.apiKeys[keyIndex]!;
      const context: ApiKeyCascadeExecutionContext = {
        keyIndex,
        attempt,
      };

      this.keyUsageCounts[keyIndex] = (this.keyUsageCounts[keyIndex] ?? 0) + 1;

      try {
        return await runner(apiKey, context);
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('Unknown error');
        lastError = normalizedError;

        onAttemptFailure?.(normalizedError, context);

        if (isNonRetryableError?.(normalizedError) === true) {
          throw normalizedError;
        }
      }
    }

    throw new Error(
      `All API keys exhausted. Last error: ${lastError?.message ?? 'Unknown'}`,
      { cause: lastError ?? undefined }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
