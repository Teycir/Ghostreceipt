import { NextRequest, NextResponse } from 'next/server';
import { assertRuntimeConfigOnLoad } from '@/lib/config/runtime-config';
import { createJsonErrorResponse } from '@/lib/libraries/backend';
import {
  CheckNullifierRequestSchema,
  createOracleRouteRateLimiters,
  deriveClaimDigest,
  deriveNullifier,
  disposeOracleRouteRateLimiters,
  disposeSharedNullifierRegistryForTests,
  getSharedNullifierRegistry,
  parseRateLimitedOracleRouteBody,
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

const NULLIFIER_RATE_LIMIT = {
  clientMaxRequests: parsePositiveIntEnv(
    'ORACLE_NULLIFIER_CLIENT_MAX_REQUESTS_PER_MINUTE',
    8
  ),
  globalMaxRequests: parsePositiveIntEnv(
    'ORACLE_NULLIFIER_GLOBAL_MAX_REQUESTS_PER_MINUTE',
    80
  ),
  clientBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_NULLIFIER_CLIENT_MAX_REQUESTS_PER_SECOND',
    2
  ),
  globalBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_NULLIFIER_GLOBAL_MAX_REQUESTS_PER_SECOND',
    10
  ),
  windowMs: 60_000,
  burstWindowMs: 1_000,
} as const;

const routeRateLimiters = createOracleRouteRateLimiters({
  ...NULLIFIER_RATE_LIMIT,
  backendScope: 'oracle_check_nullifier',
});
const nullifierRegistry = getSharedNullifierRegistry({
  cleanupIntervalMs: parsePositiveIntEnv(
    'ORACLE_NULLIFIER_CLEANUP_INTERVAL_MS',
    60_000
  ),
  maxEntries: parsePositiveIntEnv(
    'ORACLE_NULLIFIER_MAX_ENTRIES',
    3_000
  ),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertRuntimeConfigOnLoad('app/api/oracle/check-nullifier/route.ts');
  } catch (error) {
    return createJsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Runtime configuration validation failed',
      status: 500,
    });
  }

  const envelope = await parseRateLimitedOracleRouteBody({
    invalidRequestMessage: 'Invalid nullifier check request',
    maxBodySizeBytes: 1024 * 5,
    rateLimit: {
      clientMaxRequests: NULLIFIER_RATE_LIMIT.clientMaxRequests,
      globalMaxRequests: NULLIFIER_RATE_LIMIT.globalMaxRequests,
      clientBurstMaxRequests: NULLIFIER_RATE_LIMIT.clientBurstMaxRequests,
      globalBurstMaxRequests: NULLIFIER_RATE_LIMIT.globalBurstMaxRequests,
      limiters: routeRateLimiters,
      messages: {
        client: 'Rate limit reached. Please wait and try again shortly.',
        global: 'Service is busy right now. Please wait and try again shortly.',
      },
    },
    request,
    schema: CheckNullifierRequestSchema,
  });
  if (!envelope.ok) {
    return envelope.response;
  }

  const { claimedAmount, messageHash, minDateUnix, nullifier } = envelope.data;
  const derivedNullifier = deriveNullifier(messageHash);
  if (nullifier && nullifier.toLowerCase() !== derivedNullifier.toLowerCase()) {
    return createJsonErrorResponse({
      code: 'INVALID_HASH',
      details: {
        expectedNullifier: derivedNullifier,
      },
      message: 'Provided nullifier does not match message hash',
      status: 400,
    });
  }

  const claimDigest = deriveClaimDigest(claimedAmount, minDateUnix);
  const registryResult = await nullifierRegistry.check({
    claimDigest,
    nullifier: derivedNullifier,
  });

  if (!registryResult.allowed) {
    return createJsonErrorResponse({
      code: 'NULLIFIER_CONFLICT',
      details: {
        nullifier: registryResult.nullifier,
        reasonCode: registryResult.reason,
      },
      message: registryResult.message,
      status: 409,
    });
  }

  return NextResponse.json({
    nullifier: registryResult.nullifier,
    status: registryResult.mode,
    valid: true,
  });
}

export function __disposeOracleNullifierRouteForTests(): void {
  disposeOracleRouteRateLimiters(routeRateLimiters);
  void disposeSharedNullifierRegistryForTests();
}
