import type { ApiKeyConfig } from './types';

export interface ApiKeyCascadeExecutionContext {
  keyIndex: number;
  attempt: number;
}

export interface ApiKeyCascadeExecuteOptions {
  delayBetweenAttemptsMs?: number;
  isNonRetryableError?: (error: Error) => boolean;
  shouldContinueToNextKey?: (
    error: Error,
    context: ApiKeyCascadeExecutionContext
  ) => boolean;
  onAttemptFailure?: (error: Error, context: ApiKeyCascadeExecutionContext) => void;
}

export interface ApiKeyCascadeMetricsKeySnapshot {
  keyIndex: number;
  successes: number;
  failures: number;
  lastSuccessAtMs: number | null;
  lastFailureAtMs: number | null;
}

export interface ApiKeyCascadeMetricsSnapshot {
  scope: string | null;
  totalExecutions: number;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  totalExhausted: number;
  totalNonRetryableStops: number;
  consecutiveFailures: number;
  lastSuccessAtMs: number | null;
  lastFailureAtMs: number | null;
  lastFailureMessage: string | null;
  keys: ApiKeyCascadeMetricsKeySnapshot[];
}

interface MutableApiKeyCascadeMetricsState {
  totalExecutions: number;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  totalExhausted: number;
  totalNonRetryableStops: number;
  consecutiveFailures: number;
  lastSuccessAtMs: number | null;
  lastFailureAtMs: number | null;
  lastFailureMessage: string | null;
  keys: Array<{
    successes: number;
    failures: number;
    lastSuccessAtMs: number | null;
    lastFailureAtMs: number | null;
  }>;
}

export interface ApiKeyCascadeConfig {
  metricsScope?: string;
}

/**
 * Provider-agnostic API key rotation + failover utility.
 * Can be reused by any API integration that needs a key pool.
 */
export class ApiKeyCascade {
  private static readonly sharedMetrics = new Map<string, MutableApiKeyCascadeMetricsState>();
  private readonly apiKeys: string[];
  private readonly rotationStrategy: ApiKeyConfig['rotationStrategy'];
  private currentKeyIndex: number;
  private readonly keyUsageCounts: number[];
  private readonly metricsScope: string | null;
  private readonly metricsState: MutableApiKeyCascadeMetricsState;

  constructor(config: ApiKeyConfig, options: ApiKeyCascadeConfig = {}) {
    this.apiKeys = ApiKeyCascade.shuffleKeys(config);
    this.rotationStrategy = config.rotationStrategy;
    this.currentKeyIndex = 0;
    this.keyUsageCounts = new Array(this.apiKeys.length).fill(0);
    this.metricsScope = options.metricsScope ?? null;
    this.metricsState = this.resolveMetricsState(this.metricsScope);
    this.ensureMetricsKeySlots();
  }

  get size(): number {
    return this.apiKeys.length;
  }

  get keys(): readonly string[] {
    return this.apiKeys;
  }

  getMetricsSnapshot(): ApiKeyCascadeMetricsSnapshot {
    return this.cloneMetricsSnapshot(this.metricsState);
  }

  static getMetricsSnapshot(scope: string): ApiKeyCascadeMetricsSnapshot | null {
    const state = ApiKeyCascade.sharedMetrics.get(scope);
    if (!state) {
      return null;
    }

    return {
      scope,
      totalExecutions: state.totalExecutions,
      totalAttempts: state.totalAttempts,
      totalSuccesses: state.totalSuccesses,
      totalFailures: state.totalFailures,
      totalExhausted: state.totalExhausted,
      totalNonRetryableStops: state.totalNonRetryableStops,
      consecutiveFailures: state.consecutiveFailures,
      lastSuccessAtMs: state.lastSuccessAtMs,
      lastFailureAtMs: state.lastFailureAtMs,
      lastFailureMessage: state.lastFailureMessage,
      keys: state.keys.map((entry, keyIndex) => ({
        keyIndex,
        successes: entry.successes,
        failures: entry.failures,
        lastSuccessAtMs: entry.lastSuccessAtMs,
        lastFailureAtMs: entry.lastFailureAtMs,
      })),
    };
  }

  static resetMetricsForTests(scope?: string): void {
    if (scope) {
      ApiKeyCascade.sharedMetrics.delete(scope);
      return;
    }

    ApiKeyCascade.sharedMetrics.clear();
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
      shouldContinueToNextKey,
      onAttemptFailure,
    } = options;
    let lastError: Error | null = null;
    this.metricsState.totalExecutions += 1;

    for (let attempt = 0; attempt < order.length; attempt++) {
      if (attempt > 0 && delayBetweenAttemptsMs > 0) {
        await this.delay(delayBetweenAttemptsMs);
      }

      const keyIndex = order[attempt]!;
      const apiKey = this.apiKeys[keyIndex]!;
      const nowMs = Date.now();
      const context: ApiKeyCascadeExecutionContext = {
        keyIndex,
        attempt,
      };

      this.keyUsageCounts[keyIndex] = (this.keyUsageCounts[keyIndex] ?? 0) + 1;
      this.metricsState.totalAttempts += 1;

      try {
        const result = await runner(apiKey, context);
        this.metricsState.totalSuccesses += 1;
        this.metricsState.consecutiveFailures = 0;
        this.metricsState.lastSuccessAtMs = nowMs;
        const keyMetrics = this.getMetricsForKey(keyIndex);
        keyMetrics.successes += 1;
        keyMetrics.lastSuccessAtMs = nowMs;
        return result;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('Unknown error');
        lastError = normalizedError;
        this.metricsState.totalFailures += 1;
        this.metricsState.consecutiveFailures += 1;
        this.metricsState.lastFailureAtMs = nowMs;
        this.metricsState.lastFailureMessage = normalizedError.message;
        const keyMetrics = this.getMetricsForKey(keyIndex);
        keyMetrics.failures += 1;
        keyMetrics.lastFailureAtMs = nowMs;

        if (isNonRetryableError?.(normalizedError) === true) {
          this.metricsState.totalNonRetryableStops += 1;
          throw normalizedError;
        }

        if (shouldContinueToNextKey && shouldContinueToNextKey(normalizedError, context) !== true) {
          throw normalizedError;
        }

        onAttemptFailure?.(normalizedError, context);
      }
    }

    this.metricsState.totalExhausted += 1;

    throw new Error(
      `All API keys exhausted. Last error: ${lastError?.message ?? 'Unknown'}`,
      { cause: lastError ?? undefined }
    );
  }

  private resolveMetricsState(scope: string | null): MutableApiKeyCascadeMetricsState {
    if (!scope) {
      return this.createInitialMetricsState();
    }

    const existing = ApiKeyCascade.sharedMetrics.get(scope);
    if (existing) {
      return existing;
    }

    const initial = this.createInitialMetricsState();
    ApiKeyCascade.sharedMetrics.set(scope, initial);
    return initial;
  }

  private createInitialMetricsState(): MutableApiKeyCascadeMetricsState {
    return {
      totalExecutions: 0,
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalExhausted: 0,
      totalNonRetryableStops: 0,
      consecutiveFailures: 0,
      lastSuccessAtMs: null,
      lastFailureAtMs: null,
      lastFailureMessage: null,
      keys: [],
    };
  }

  private ensureMetricsKeySlots(): void {
    while (this.metricsState.keys.length < this.apiKeys.length) {
      this.metricsState.keys.push({
        successes: 0,
        failures: 0,
        lastSuccessAtMs: null,
        lastFailureAtMs: null,
      });
    }
  }

  private getMetricsForKey(keyIndex: number): MutableApiKeyCascadeMetricsState['keys'][number] {
    this.ensureMetricsKeySlots();
    const existing = this.metricsState.keys[keyIndex];
    if (!existing) {
      throw new Error(`Missing metrics bucket for key index ${keyIndex}`);
    }

    return existing;
  }

  private cloneMetricsSnapshot(
    state: MutableApiKeyCascadeMetricsState
  ): ApiKeyCascadeMetricsSnapshot {
    return {
      scope: this.metricsScope,
      totalExecutions: state.totalExecutions,
      totalAttempts: state.totalAttempts,
      totalSuccesses: state.totalSuccesses,
      totalFailures: state.totalFailures,
      totalExhausted: state.totalExhausted,
      totalNonRetryableStops: state.totalNonRetryableStops,
      consecutiveFailures: state.consecutiveFailures,
      lastSuccessAtMs: state.lastSuccessAtMs,
      lastFailureAtMs: state.lastFailureAtMs,
      lastFailureMessage: state.lastFailureMessage,
      keys: state.keys.map((entry, keyIndex) => ({
        keyIndex,
        successes: entry.successes,
        failures: entry.failures,
        lastSuccessAtMs: entry.lastSuccessAtMs,
        lastFailureAtMs: entry.lastFailureAtMs,
      })),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
