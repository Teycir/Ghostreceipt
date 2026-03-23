import { createRateLimiter, type RateLimiter } from '@/lib/security/rate-limit';
import { createRateLimitErrorResponse } from '@/lib/libraries/backend';
import { type NextResponse } from 'next/server';

export interface OracleRouteRateLimiters {
  clientLimiter: RateLimiter;
  globalLimiter: RateLimiter;
  clientBurstLimiter?: RateLimiter;
  globalBurstLimiter?: RateLimiter;
}

export interface CreateOracleRouteRateLimitersOptions {
  clientMaxRequests: number;
  globalMaxRequests: number;
  windowMs: number;
  clientBurstMaxRequests?: number;
  globalBurstMaxRequests?: number;
  burstWindowMs?: number;
}

export function createOracleRouteRateLimiters({
  clientMaxRequests,
  globalMaxRequests,
  windowMs,
  clientBurstMaxRequests,
  globalBurstMaxRequests,
  burstWindowMs = 1000,
}: CreateOracleRouteRateLimitersOptions): OracleRouteRateLimiters {
  const limiters: OracleRouteRateLimiters = {
    clientLimiter: createRateLimiter({
      windowMs,
      maxRequests: clientMaxRequests,
    }),
    globalLimiter: createRateLimiter({
      windowMs,
      maxRequests: globalMaxRequests,
    }),
  };

  if (
    clientBurstMaxRequests !== undefined &&
    clientBurstMaxRequests > 0 &&
    burstWindowMs > 0
  ) {
    limiters.clientBurstLimiter = createRateLimiter({
      windowMs: burstWindowMs,
      maxRequests: clientBurstMaxRequests,
    });
  }

  if (
    globalBurstMaxRequests !== undefined &&
    globalBurstMaxRequests > 0 &&
    burstWindowMs > 0
  ) {
    limiters.globalBurstLimiter = createRateLimiter({
      windowMs: burstWindowMs,
      maxRequests: globalBurstMaxRequests,
    });
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

export function checkOracleRouteRateLimits({
  clientId,
  clientMaxRequests,
  globalMaxRequests,
  clientBurstMaxRequests,
  globalBurstMaxRequests,
  globalScopeKey = 'global',
  limiters,
  messages,
}: CheckOracleRouteRateLimitsInput): NextResponse | null {
  if (limiters.globalBurstLimiter && globalBurstMaxRequests !== undefined) {
    const globalBurstRateLimit = limiters.globalBurstLimiter.check(globalScopeKey);
    if (!globalBurstRateLimit.allowed) {
      return createRateLimitErrorResponse({
        limit: globalBurstMaxRequests,
        message: messages.global,
        resetAt: globalBurstRateLimit.resetAt,
      });
    }
  }

  const globalRateLimit = limiters.globalLimiter.check(globalScopeKey);
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
    const clientBurstRateLimit = limiters.clientBurstLimiter.check(clientId);
    if (!clientBurstRateLimit.allowed) {
      return createRateLimitErrorResponse({
        limit: clientBurstMaxRequests,
        message: messages.client,
        resetAt: clientBurstRateLimit.resetAt,
      });
    }
  }

  const clientRateLimit = limiters.clientLimiter.check(clientId);
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
