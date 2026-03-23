import { NextRequest, NextResponse } from 'next/server';
import {
  type ErrorResponse,
  OracleFetchTxRequestSchema,
} from '@/lib/validation/schemas';
import { createRateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';
import { replayProtection } from '@/lib/security/replay';
import { parseSecureJson } from '@/lib/security/secure-json';
import { secureError } from '@/lib/security/secure-logging';
import {
  createRateLimitErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  fetchAndSignOracleTransaction,
  mapFetchTxErrorToResponse,
} from '@ghostreceipt/backend-core/http';

const rateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
});

const globalRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 200,
});

const ANON_IDEMPOTENCY_COOKIE = 'gr_sid';

function createAnonymousSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function withAnonymousSessionCookie(
  response: NextResponse,
  anonymousSessionId: string | null
): NextResponse {
  if (!anonymousSessionId) {
    return response;
  }

  response.cookies.set({
    name: ANON_IDEMPOTENCY_COOKIE,
    value: anonymousSessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

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
      withAnonymousSessionCookie(response, anonymousSessionIdToSet);
    const globalRateLimit = globalRateLimiter.check('global');

    if (!globalRateLimit.allowed) {
      return withSession(
        createRateLimitErrorResponse({
          limit: 200,
          message: 'Service is busy. Please try again later.',
          resetAt: globalRateLimit.resetAt,
        })
      );
    }

    if (clientId) {
      const rateLimit = rateLimiter.check(clientId);

      if (!rateLimit.allowed) {
        return withSession(
          createRateLimitErrorResponse({
            limit: 10,
            message: 'Too many requests. Please try again later.',
            resetAt: rateLimit.resetAt,
          })
        );
      }
    }
    // Parse request body with security controls
    let body: unknown;
    try {
      body = await parseSecureJson(request, { maxSize: 1024 * 10 }); // 10KB limit
    } catch (error) {
      const message =
        error instanceof Error &&
        (
          error.message.startsWith('Payload too large') ||
          error.message.startsWith('Invalid Content-Type') ||
          error.message.startsWith('Empty request body') ||
          error.message.startsWith('JSON object too complex') ||
          error.message.startsWith('JSON nesting too deep')
        )
          ? error.message
          : 'Invalid JSON request body';
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_HASH',
          message,
        },
      };
      return withSession(NextResponse.json(errorResponse, { status: 400 }));
    }

    // Validate request body
    const validationResult = OracleFetchTxRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_HASH',
          message: 'Invalid request parameters',
          details: validationResult.error.flatten(),
        },
      };
      return withSession(NextResponse.json(errorResponse, { status: 400 }));
    }

    const { chain, txHash, idempotencyKey } = validationResult.data;

    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (normalizedIdempotencyKey) {
      const anonymousSessionIdFromCookie =
        request.cookies.get(ANON_IDEMPOTENCY_COOKIE)?.value ?? null;
      const anonymousSessionId =
        anonymousSessionIdFromCookie ?? createAnonymousSessionId();
      const idempotencyScope = clientId ?? `sid:${anonymousSessionId}`;

      if (!clientId && !anonymousSessionIdFromCookie) {
        anonymousSessionIdToSet = anonymousSessionId;
      }

      const replayKey = `${idempotencyScope}:${normalizedIdempotencyKey}`;
      const replayCheck = replayProtection.check(replayKey, Date.now());

      if (!replayCheck.allowed) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'REPLAY_DETECTED',
            message: replayCheck.reason ?? 'Duplicate idempotency key',
          },
        };
        return withSession(NextResponse.json(errorResponse, { status: 409 }));
      }

      reservedReplayKey = replayKey;
    }

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
    if (reservedReplayKey) {
      replayProtection.release(reservedReplayKey);
    }

    secureError('[Oracle API] Error:', error);

    const mapped = mapFetchTxErrorToResponse(error);

    const errorResponse: ErrorResponse = {
      error: {
        code: mapped.code,
        message: mapped.message,
      },
    };

    return withAnonymousSessionCookie(
      NextResponse.json(errorResponse, { status: mapped.status }),
      anonymousSessionIdToSet
    );
  }
}

export const mapErrorToResponse = mapFetchTxErrorToResponse;

export function __disposeOracleFetchRouteForTests(): void {
  rateLimiter.dispose();
  globalRateLimiter.dispose();
  replayProtection.dispose();
  resetCachedOracleSignerForTests();
}
