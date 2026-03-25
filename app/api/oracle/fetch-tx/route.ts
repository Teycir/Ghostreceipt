import { NextRequest, NextResponse } from 'next/server';
import {
  OracleFetchTxRequestSchema,
} from '@/lib/validation/schemas';
import { secureError } from '@/lib/security/secure-logging';
import {
  createJsonErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  __resetFetchTxCanonicalCacheForTests,
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  disposeFetchTxReplayProtection,
  FETCH_TX_ANON_IDEMPOTENCY_COOKIE,
  fetchAndSignOracleTransaction,
  mapFetchTxErrorToResponse,
  parseRateLimitedOracleRouteBody,
  releaseFetchTxReplayKey,
  reserveFetchTxReplayKey,
  withFetchTxAnonymousSessionCookie,
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

const FETCH_TX_RATE_LIMIT = {
  clientMaxRequests: parsePositiveIntEnv(
    'ORACLE_FETCH_TX_CLIENT_MAX_REQUESTS_PER_MINUTE',
    6
  ),
  globalMaxRequests: parsePositiveIntEnv(
    'ORACLE_FETCH_TX_GLOBAL_MAX_REQUESTS_PER_MINUTE',
    60
  ),
  clientBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_FETCH_TX_CLIENT_MAX_REQUESTS_PER_SECOND',
    2
  ),
  globalBurstMaxRequests: parsePositiveIntEnv(
    'ORACLE_FETCH_TX_GLOBAL_MAX_REQUESTS_PER_SECOND',
    12
  ),
  windowMs: 60000,
  burstWindowMs: 1000,
} as const;

const routeRateLimiters = createOracleRouteRateLimiters({
  ...FETCH_TX_RATE_LIMIT,
  backendScope: 'oracle_fetch_tx',
});

/**
 * POST /api/oracle/fetch-tx
 * 
 * Fetch canonical transaction data with oracle signature
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let reservedReplayKey: string | null = null;
  let anonymousSessionIdToSet: string | null = null;

  try {
    const withSession = (response: NextResponse): NextResponse =>
      withFetchTxAnonymousSessionCookie(response, anonymousSessionIdToSet);
    const envelope = await parseRateLimitedOracleRouteBody({
      invalidRequestMessage: 'Invalid request parameters',
      maxBodySizeBytes: 1024 * 10,
      rateLimit: {
        clientMaxRequests: FETCH_TX_RATE_LIMIT.clientMaxRequests,
        globalMaxRequests: FETCH_TX_RATE_LIMIT.globalMaxRequests,
        clientBurstMaxRequests: FETCH_TX_RATE_LIMIT.clientBurstMaxRequests,
        globalBurstMaxRequests: FETCH_TX_RATE_LIMIT.globalBurstMaxRequests,
        limiters: routeRateLimiters,
        messages: {
          client: 'Rate limit reached. Please wait and try again shortly.',
          global: 'Service is busy right now. Please wait and try again shortly.',
        },
      },
      request,
      schema: OracleFetchTxRequestSchema,
    });
    if (!envelope.ok) {
      return withSession(envelope.response);
    }

    const { clientId, data } = envelope;
    const { chain, txHash, ethereumAsset, idempotencyKey } = data;

    const replayReservation = reserveFetchTxReplayKey({
      anonymousSessionIdFromCookie:
        request.cookies.get(FETCH_TX_ANON_IDEMPOTENCY_COOKIE)?.value ?? null,
      clientId,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    });
    if (replayReservation.anonymousSessionIdToSet) {
      anonymousSessionIdToSet = replayReservation.anonymousSessionIdToSet;
    }
    if (replayReservation.replayConflictReason) {
      return withSession(
        createJsonErrorResponse({
          code: 'REPLAY_DETECTED',
          message: replayReservation.replayConflictReason,
          status: 409,
        })
      );
    }
    reservedReplayKey = replayReservation.replayKey;

    const signedResult = await fetchAndSignOracleTransaction(
      chain,
      txHash,
      {
        ...(chain === 'ethereum' && ethereumAsset
          ? { ethereumAsset }
          : {}),
      }
    );

    return withSession(NextResponse.json({
      data: signedResult.data,
      cached: signedResult.cached,
    }));
  } catch (error) {
    releaseFetchTxReplayKey(reservedReplayKey);

    secureError('[Oracle API] Error:', error);

    const mapped = mapFetchTxErrorToResponse(error);

    return withFetchTxAnonymousSessionCookie(
      createJsonErrorResponse({
        code: mapped.code,
        message: mapped.message,
        status: mapped.status,
      }),
      anonymousSessionIdToSet
    );
  }
}

export const mapErrorToResponse = mapFetchTxErrorToResponse;

export function __disposeOracleFetchRouteForTests(): void {
  disposeOracleRouteRateLimiters(routeRateLimiters);
  disposeFetchTxReplayProtection();
  __resetFetchTxCanonicalCacheForTests();
  resetCachedOracleSignerForTests();
}
