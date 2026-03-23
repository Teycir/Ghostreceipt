import { NextRequest, NextResponse } from 'next/server';
import {
  createJsonErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  parseRateLimitedOracleRouteBody,
  VerifySignatureRequestSchema,
  verifyOracleSignature,
} from '@ghostreceipt/backend-core/http';

function parsePositiveIntEnv(key: string, fallback: number): number {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const VERIFY_SIGNATURE_RATE_LIMIT = {
  clientMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_CLIENT_MAX_REQUESTS_PER_MINUTE',
    20
  ),
  globalMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_GLOBAL_MAX_REQUESTS_PER_MINUTE',
    200
  ),
  clientBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_CLIENT_MAX_REQUESTS_PER_SECOND',
    5
  ),
  globalBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_GLOBAL_MAX_REQUESTS_PER_SECOND',
    75
  ),
  windowMs: 60000,
  burstWindowMs: 1000,
} as const;

const routeRateLimiters = createOracleRouteRateLimiters(VERIFY_SIGNATURE_RATE_LIMIT);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const envelope = await parseRateLimitedOracleRouteBody({
    invalidRequestMessage: 'Invalid signature verification request',
    maxBodySizeBytes: 1024 * 5,
    rateLimit: {
      clientMaxRequests: VERIFY_SIGNATURE_RATE_LIMIT.clientMaxRequests,
      globalMaxRequests: VERIFY_SIGNATURE_RATE_LIMIT.globalMaxRequests,
      clientBurstMaxRequests: VERIFY_SIGNATURE_RATE_LIMIT.clientBurstMaxRequests,
      globalBurstMaxRequests: VERIFY_SIGNATURE_RATE_LIMIT.globalBurstMaxRequests,
      limiters: routeRateLimiters,
      messages: {
        client: 'Rate limit reached. Please wait and try again shortly.',
        global: 'Service is busy right now. Please wait and try again shortly.',
      },
    },
    request,
    schema: VerifySignatureRequestSchema,
  });
  if (!envelope.ok) {
    return envelope.response;
  }

  const verification = verifyOracleSignature(envelope.data, {
    missingKeyMessage: 'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)',
  });
  if (verification.kind === 'config_error') {
    return createJsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message: verification.message,
      status: 500,
    });
  }

  return NextResponse.json({
    valid: verification.valid,
  });
}

export function __disposeOracleVerifyRouteForTests(): void {
  disposeOracleRouteRateLimiters(routeRateLimiters);
  resetCachedOracleSignerForTests();
}
