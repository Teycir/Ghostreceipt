import { NextRequest, NextResponse } from 'next/server';
import {
  OracleFetchTxRequestSchema,
} from '@/lib/validation/schemas';
import { getClientIdentifier } from '@/lib/security/rate-limit';
import { secureError } from '@/lib/security/secure-logging';
import {
  createJsonErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  checkOracleRouteRateLimits,
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  disposeFetchTxReplayProtection,
  FETCH_TX_ANON_IDEMPOTENCY_COOKIE,
  fetchAndSignOracleTransaction,
  mapFetchTxErrorToResponse,
  parseSecureJsonWithError,
  releaseFetchTxReplayKey,
  reserveFetchTxReplayKey,
  validateBodyWithSchema,
  withFetchTxAnonymousSessionCookie,
} from '@ghostreceipt/backend-core/http';

const routeRateLimiters = createOracleRouteRateLimiters({
  clientMaxRequests: 10,
  globalMaxRequests: 200,
  windowMs: 60000,
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
    const clientId = getClientIdentifier(request);
    const withSession = (response: NextResponse): NextResponse =>
      withFetchTxAnonymousSessionCookie(response, anonymousSessionIdToSet);
    const rateLimitResponse = checkOracleRouteRateLimits({
      clientId,
      clientMaxRequests: 10,
      globalMaxRequests: 200,
      limiters: routeRateLimiters,
      messages: {
        client: 'Too many requests. Please try again later.',
        global: 'Service is busy. Please try again later.',
      },
    });
    if (rateLimitResponse) {
      return withSession(rateLimitResponse);
    }
    const bodyResult = await parseSecureJsonWithError(request, {
      maxSize: 1024 * 10,
    });
    if (!bodyResult.ok) {
      return withSession(bodyResult.response);
    }

    const validationResult = validateBodyWithSchema({
      body: bodyResult.data,
      options: {
        code: 'INVALID_HASH',
        message: 'Invalid request parameters',
      },
      schema: OracleFetchTxRequestSchema,
    });
    if (!validationResult.ok) {
      return withSession(validationResult.response);
    }

    const { chain, txHash, idempotencyKey } = validationResult.data;

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

    const blockchairApiKey = process.env['BLOCKCHAIR_API_KEY'];
    const signedResult = await fetchAndSignOracleTransaction(
      chain,
      txHash,
      blockchairApiKey ? { blockchairApiKey } : {}
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
  resetCachedOracleSignerForTests();
}
