import { createRateLimiter, type RateLimiter } from '@/lib/security/rate-limit';
import { createRateLimitErrorResponse } from '@/lib/libraries/backend';
import { type NextResponse } from 'next/server';

export interface OracleRouteRateLimiters {
  clientLimiter: RateLimiter;
  globalLimiter: RateLimiter;
}

export interface CreateOracleRouteRateLimitersOptions {
  clientMaxRequests: number;
  globalMaxRequests: number;
  windowMs: number;
}

export function createOracleRouteRateLimiters({
  clientMaxRequests,
  globalMaxRequests,
  windowMs,
}: CreateOracleRouteRateLimitersOptions): OracleRouteRateLimiters {
  return {
    clientLimiter: createRateLimiter({
      windowMs,
      maxRequests: clientMaxRequests,
    }),
    globalLimiter: createRateLimiter({
      windowMs,
      maxRequests: globalMaxRequests,
    }),
  };
}

export interface OracleRouteRateLimitMessages {
  client: string;
  global: string;
}

interface CheckOracleRouteRateLimitsInput {
  clientId: string | null;
  clientMaxRequests: number;
  globalMaxRequests: number;
  globalScopeKey?: string;
  limiters: OracleRouteRateLimiters;
  messages: OracleRouteRateLimitMessages;
}

export function checkOracleRouteRateLimits({
  clientId,
  clientMaxRequests,
  globalMaxRequests,
  globalScopeKey = 'global',
  limiters,
  messages,
}: CheckOracleRouteRateLimitsInput): NextResponse | null {
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
}
