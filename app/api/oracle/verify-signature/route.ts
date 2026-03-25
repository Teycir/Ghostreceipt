import { NextRequest, NextResponse } from 'next/server';
import {
  createJsonErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  __resetOracleTransparencyLogCacheForTests,
  createOracleRouteRateLimiters,
  disposeSharedOracleAuthReplayRegistryForTests,
  getSharedOracleAuthReplayRegistry,
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
    12
  ),
  globalMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_GLOBAL_MAX_REQUESTS_PER_MINUTE',
    60
  ),
  clientBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_CLIENT_MAX_REQUESTS_PER_SECOND',
    12
  ),
  globalBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_VERIFY_GLOBAL_MAX_REQUESTS_PER_SECOND',
    20
  ),
  windowMs: 60000,
  burstWindowMs: 1000,
} as const;

const routeRateLimiters = createOracleRouteRateLimiters({
  ...VERIFY_SIGNATURE_RATE_LIMIT,
  backendScope: 'oracle_verify_signature',
});
const verifyReplayRegistry = getSharedOracleAuthReplayRegistry({
  cleanupIntervalMs: parsePositiveIntEnv(
    'ORACLE_VERIFY_REPLAY_CLEANUP_INTERVAL_MS',
    60_000
  ),
  maxEntries: parsePositiveIntEnv(
    'ORACLE_VERIFY_REPLAY_MAX_ENTRIES',
    2_000
  ),
  maxFutureSkewSeconds: parsePositiveIntEnv(
    'ORACLE_VERIFY_REPLAY_MAX_FUTURE_SKEW_SECONDS',
    30
  ),
});

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

  if (verification.valid) {
    const replay = await verifyReplayRegistry.check({
      payload: envelope.data,
      scope: envelope.data.oraclePubKeyId,
    });

    if (!replay.allowed) {
      return createJsonErrorResponse({
        code: 'REPLAY_DETECTED',
        details: {
          reasonCode: replay.reason,
        },
        message: replay.message,
        status: 409,
      });
    }
  }

  return NextResponse.json(
    verification.valid
      ? {
          valid: true,
        }
      : {
          valid: false,
          ...(verification.reason ? { reason: verification.reason } : {}),
          ...(verification.message ? { message: verification.message } : {}),
        }
  );
}

export function __disposeOracleVerifyRouteForTests(): void {
  disposeOracleRouteRateLimiters(routeRateLimiters);
  void disposeSharedOracleAuthReplayRegistryForTests();
  __resetOracleTransparencyLogCacheForTests();
  resetCachedOracleSignerForTests();
}
