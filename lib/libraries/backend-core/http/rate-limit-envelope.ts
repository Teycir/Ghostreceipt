import { createRateLimiter, type RateLimiter } from '@/lib/security/rate-limit';
import { createRateLimitErrorResponse } from '@/lib/libraries/backend';
import { secureWarn } from '@/lib/security/secure-logging';
import { type NextResponse } from 'next/server';

interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimiterLike {
  check(identifier: string): RateLimitDecision | Promise<RateLimitDecision>;
  dispose(): void;
}

type OracleRateLimitBackendMode = 'legacy' | 'durable_prefer' | 'durable_strict';

interface OracleRateLimitBackendConfig {
  mode: OracleRateLimitBackendMode;
  durableUrl: string | null;
  durableTimeoutMs: number;
  breakerFailures: number;
  breakerCooldownMs: number;
}

interface DurableRateLimitPayload {
  bucket: string;
  identifier: string;
  maxRequests: number;
  windowMs: number;
}

class DurableBackendError extends Error {
  readonly kind: 'technical' | 'fatal';

  constructor(kind: 'technical' | 'fatal', message: string) {
    super(message);
    this.kind = kind;
  }
}

class DurableRateLimiterClient {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  async check(payload: DurableRateLimitPayload): Promise<RateLimitDecision> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.url, {
        body: JSON.stringify(payload),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown fetch failure';
      throw new DurableBackendError(
        'technical',
        `Durable rate-limit request failed: ${message}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      return this.parseDenyResponse(response, payload.windowMs);
    }

    if (response.status >= 500) {
      throw new DurableBackendError(
        'technical',
        `Durable rate-limit backend error: HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new DurableBackendError(
        'fatal',
        `Durable rate-limit backend rejected request: HTTP ${response.status}`
      );
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error';
      throw new DurableBackendError(
        'fatal',
        `Durable rate-limit backend returned non-JSON response: ${message}`
      );
    }

    return parseDecisionResponse(parsed, payload.windowMs);
  }

  private async parseDenyResponse(
    response: Response,
    windowMs: number
  ): Promise<RateLimitDecision> {
    try {
      const parsed = await response.json();
      return parseDecisionResponse(parsed, windowMs);
    } catch (error) {
      const details = error instanceof Error ? error.message : 'unknown parse error';
      secureWarn('[RateLimit] Failed to parse durable 429 response:', details);
      const fallbackResetAt = Date.now() + windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt: fallbackResetAt,
      };
    }
  }
}

class ResilientRateLimiter implements RateLimiterLike {
  private readonly localLimiter: RateLimiter;
  private readonly durableClient: DurableRateLimiterClient | null;
  private readonly mode: OracleRateLimitBackendMode;
  private readonly bucket: string;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly breakerFailures: number;
  private readonly breakerCooldownMs: number;
  private consecutiveTechnicalFailures = 0;
  private durableDisabledUntil = 0;

  constructor(options: {
    localLimiter: RateLimiter;
    durableClient: DurableRateLimiterClient | null;
    mode: OracleRateLimitBackendMode;
    bucket: string;
    maxRequests: number;
    windowMs: number;
    breakerFailures: number;
    breakerCooldownMs: number;
  }) {
    this.localLimiter = options.localLimiter;
    this.durableClient = options.durableClient;
    this.mode = options.mode;
    this.bucket = options.bucket;
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.breakerFailures = options.breakerFailures;
    this.breakerCooldownMs = options.breakerCooldownMs;
  }

  async check(identifier: string): Promise<RateLimitDecision> {
    if (this.mode === 'legacy') {
      return this.localLimiter.check(identifier);
    }

    const now = Date.now();
    const shouldUseDurable =
      this.durableClient !== null && now >= this.durableDisabledUntil;

    if (!shouldUseDurable) {
      if (this.mode === 'durable_strict') {
        throw new DurableBackendError(
          'technical',
          'Durable rate-limit backend is unavailable in strict mode'
        );
      }

      return this.localLimiter.check(identifier);
    }

    try {
      const durableDecision = await this.durableClient.check({
        bucket: this.bucket,
        identifier,
        maxRequests: this.maxRequests,
        windowMs: this.windowMs,
      });

      this.consecutiveTechnicalFailures = 0;
      this.durableDisabledUntil = 0;
      return durableDecision;
    } catch (error) {
      const backendError = normalizeDurableBackendError(error);

      if (backendError.kind !== 'technical') {
        throw backendError;
      }

      if (this.mode === 'durable_strict') {
        throw backendError;
      }

      this.consecutiveTechnicalFailures += 1;
      if (this.consecutiveTechnicalFailures >= this.breakerFailures) {
        this.durableDisabledUntil = now + this.breakerCooldownMs;
      }

      return this.localLimiter.check(identifier);
    }
  }

  dispose(): void {
    this.localLimiter.dispose();
  }
}

export interface OracleRouteRateLimiters {
  clientLimiter: RateLimiterLike;
  globalLimiter: RateLimiterLike;
  clientBurstLimiter?: RateLimiterLike;
  globalBurstLimiter?: RateLimiterLike;
}

export interface CreateOracleRouteRateLimitersOptions {
  clientMaxRequests: number;
  globalMaxRequests: number;
  windowMs: number;
  clientBurstMaxRequests?: number;
  globalBurstMaxRequests?: number;
  burstWindowMs?: number;
  backendScope?: string;
}

export function createOracleRouteRateLimiters({
  clientMaxRequests,
  globalMaxRequests,
  windowMs,
  clientBurstMaxRequests,
  globalBurstMaxRequests,
  burstWindowMs = 1000,
  backendScope = 'oracle',
}: CreateOracleRouteRateLimitersOptions): OracleRouteRateLimiters {
  const backendConfig = getOracleRateLimitBackendConfig();
  const durableClient = backendConfig.durableUrl
    ? new DurableRateLimiterClient(backendConfig.durableUrl, backendConfig.durableTimeoutMs)
    : null;

  const createLimiter = (
    bucketSuffix: string,
    limiterWindowMs: number,
    limiterMaxRequests: number
  ): RateLimiterLike => {
    const localLimiter = createRateLimiter({
      windowMs: limiterWindowMs,
      maxRequests: limiterMaxRequests,
    });

    return new ResilientRateLimiter({
      breakerCooldownMs: backendConfig.breakerCooldownMs,
      breakerFailures: backendConfig.breakerFailures,
      bucket: `${backendScope}:${bucketSuffix}`,
      durableClient,
      localLimiter,
      maxRequests: limiterMaxRequests,
      mode: backendConfig.mode,
      windowMs: limiterWindowMs,
    });
  };

  const limiters: OracleRouteRateLimiters = {
    clientLimiter: createLimiter('client', windowMs, clientMaxRequests),
    globalLimiter: createLimiter('global', windowMs, globalMaxRequests),
  };

  if (
    clientBurstMaxRequests !== undefined &&
    clientBurstMaxRequests > 0 &&
    burstWindowMs > 0
  ) {
    limiters.clientBurstLimiter = createLimiter(
      'client_burst',
      burstWindowMs,
      clientBurstMaxRequests
    );
  }

  if (
    globalBurstMaxRequests !== undefined &&
    globalBurstMaxRequests > 0 &&
    burstWindowMs > 0
  ) {
    limiters.globalBurstLimiter = createLimiter(
      'global_burst',
      burstWindowMs,
      globalBurstMaxRequests
    );
  }

  return limiters;
}

export interface OracleRouteRateLimitMessages {
  client: string;
  global: string;
}

interface CheckOracleRouteRateLimitsInput {
  clientId: string | null;
  clientMaxRequests: number;
  globalMaxRequests: number;
  clientBurstMaxRequests?: number;
  globalBurstMaxRequests?: number;
  globalScopeKey?: string;
  limiters: OracleRouteRateLimiters;
  messages: OracleRouteRateLimitMessages;
}

export async function checkOracleRouteRateLimits({
  clientId,
  clientMaxRequests,
  globalMaxRequests,
  clientBurstMaxRequests,
  globalBurstMaxRequests,
  globalScopeKey = 'global',
  limiters,
  messages,
}: CheckOracleRouteRateLimitsInput): Promise<NextResponse | null> {
  if (limiters.globalBurstLimiter && globalBurstMaxRequests !== undefined) {
    const globalBurstRateLimit = await limiters.globalBurstLimiter.check(globalScopeKey);
    if (!globalBurstRateLimit.allowed) {
      return createRateLimitErrorResponse({
        limit: globalBurstMaxRequests,
        message: messages.global,
        resetAt: globalBurstRateLimit.resetAt,
      });
    }
  }

  const globalRateLimit = await limiters.globalLimiter.check(globalScopeKey);
  if (!globalRateLimit.allowed) {
    return createRateLimitErrorResponse({
      limit: globalMaxRequests,
      message: messages.global,
      resetAt: globalRateLimit.resetAt,
    });
  }

  if (!clientId) {
    return null;
  }

  if (limiters.clientBurstLimiter && clientBurstMaxRequests !== undefined) {
    const clientBurstRateLimit = await limiters.clientBurstLimiter.check(clientId);
    if (!clientBurstRateLimit.allowed) {
      return createRateLimitErrorResponse({
        limit: clientBurstMaxRequests,
        message: messages.client,
        resetAt: clientBurstRateLimit.resetAt,
      });
    }
  }

  const clientRateLimit = await limiters.clientLimiter.check(clientId);
  if (!clientRateLimit.allowed) {
    return createRateLimitErrorResponse({
      limit: clientMaxRequests,
      message: messages.client,
      resetAt: clientRateLimit.resetAt,
    });
  }

  return null;
}

export function disposeOracleRouteRateLimiters(limiters: OracleRouteRateLimiters): void {
  limiters.clientLimiter.dispose();
  limiters.globalLimiter.dispose();
  limiters.clientBurstLimiter?.dispose();
  limiters.globalBurstLimiter?.dispose();
}

function getOracleRateLimitBackendConfig(): OracleRateLimitBackendConfig {
  const mode = parseOracleRateLimitBackendMode(process.env['ORACLE_RATE_LIMIT_BACKEND']);
  const durableUrl = normalizeDurableUrl(process.env['ORACLE_RATE_LIMIT_DURABLE_URL']);

  return {
    mode,
    durableUrl,
    durableTimeoutMs: parsePositiveIntEnv(
      process.env['ORACLE_RATE_LIMIT_DURABLE_TIMEOUT_MS'],
      120
    ),
    breakerFailures: parsePositiveIntEnv(
      process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS'],
      5
    ),
    breakerCooldownMs: parsePositiveIntEnv(
      process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS'],
      30_000
    ),
  };
}

function parseOracleRateLimitBackendMode(rawValue: string | undefined): OracleRateLimitBackendMode {
  if (!rawValue) {
    return 'legacy';
  }

  const normalized = rawValue.trim().toLowerCase();
  if (
    normalized === 'legacy' ||
    normalized === 'durable_prefer' ||
    normalized === 'durable_strict'
  ) {
    return normalized;
  }

  return 'legacy';
}

function normalizeDurableUrl(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return null;
  }

  try {
    new URL(normalized);
    return normalized;
  } catch {
    secureWarn('[RateLimit] Invalid ORACLE_RATE_LIMIT_DURABLE_URL configured:', normalized);
    return null;
  }
}

function parsePositiveIntEnv(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseDecisionResponse(payload: unknown, fallbackWindowMs: number): RateLimitDecision {
  if (!payload || typeof payload !== 'object') {
    throw new DurableBackendError(
      'fatal',
      'Durable rate-limit backend returned malformed payload'
    );
  }

  const candidate = payload as Partial<RateLimitDecision>;
  if (typeof candidate.allowed !== 'boolean') {
    throw new DurableBackendError(
      'fatal',
      'Durable rate-limit backend payload missing allowed boolean'
    );
  }

  const remaining =
    typeof candidate.remaining === 'number' && Number.isFinite(candidate.remaining)
      ? Math.max(0, Math.floor(candidate.remaining))
      : 0;

  const resetAt =
    typeof candidate.resetAt === 'number' && Number.isFinite(candidate.resetAt)
      ? candidate.resetAt
      : Date.now() + fallbackWindowMs;

  return {
    allowed: candidate.allowed,
    remaining,
    resetAt,
  };
}

function normalizeDurableBackendError(error: unknown): DurableBackendError {
  if (error instanceof DurableBackendError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'unknown durable backend error';
  return new DurableBackendError('technical', message);
}
