import { NextRequest, NextResponse } from 'next/server';
import {
  CanonicalTxDataSchema,
  type ErrorResponse,
  type OraclePayloadV1,
  OracleFetchTxRequestSchema,
} from '@/lib/validation/schemas';
import { ProviderCascade } from '@/lib/providers/cascade';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { BlockchairProvider } from '@/lib/providers/bitcoin/blockchair';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { createRateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';
import { replayProtection } from '@/lib/security/replay';
import { parseSecureJson } from '@/lib/security/secure-json';
import { secureError } from '@/lib/security/secure-logging';
import type { Provider, ProviderError } from '@/lib/providers/types';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import {
  createRateLimitErrorResponse,
  getCachedOracleSignerFromEnv,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';

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

function mapErrorToResponse(error: unknown): {
  code: ErrorResponse['error']['code'];
  message: string;
  status: number;
} {
  const code: ErrorResponse['error']['code'] = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  const status = 500;

  if (!(error instanceof Error)) {
    return { code, message, status };
  }

  message = error.message;
  const normalizedMessage = message.toLowerCase();
  const providerCode = (error as Partial<ProviderError>).code;

  if (providerCode === 'NOT_FOUND') {
    return {
      code: 'TRANSACTION_NOT_FOUND',
      message,
      status: 404,
    };
  }

  if (providerCode === 'TIMEOUT') {
    return {
      code: 'PROVIDER_TIMEOUT',
      message,
      status: 504,
    };
  }

  if (providerCode === 'RATE_LIMIT') {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      status: 429,
    };
  }

  if (providerCode === 'REVERTED') {
    return {
      code: 'TRANSACTION_REVERTED',
      message,
      status: 422,
    };
  }

  if (providerCode === 'PROVIDER_ERROR') {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
    };
  }

  if (
    normalizedMessage.includes('invalid') &&
    normalizedMessage.includes('transaction hash')
  ) {
    return {
      code: 'INVALID_HASH',
      message,
      status: 400,
    };
  }

  if (normalizedMessage.includes('not found')) {
    return {
      code: 'TRANSACTION_NOT_FOUND',
      message,
      status: 404,
    };
  }

  if (normalizedMessage.includes('timeout')) {
    return {
      code: 'PROVIDER_TIMEOUT',
      message,
      status: 504,
    };
  }

  if (
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests')
  ) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      status: 429,
    };
  }

  if (normalizedMessage.includes('revert')) {
    return {
      code: 'TRANSACTION_REVERTED',
      message,
      status: 422,
    };
  }

  if (normalizedMessage.includes('provider')) {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
    };
  }

  return { code, message, status };
}

function loadEtherscanKeysFromEnv(): string[] {
  const candidates = [
    process.env['ETHERSCAN_API_KEY'],
    process.env['ETHERSCAN_API_KEY_1'],
    process.env['ETHERSCAN_API_KEY_2'],
    process.env['ETHERSCAN_API_KEY_3'],
    process.env['ETHERSCAN_API_KEY_4'],
    process.env['ETHERSCAN_API_KEY_5'],
    process.env['ETHERSCAN_API_KEY_6'],
  ]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);

  return Array.from(new Set(candidates));
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

    // Initialize providers based on chain
    let cascade: ProviderCascade;

    if (chain === 'bitcoin') {
      const blockchairApiKey = process.env['BLOCKCHAIR_API_KEY'];
      const providers: Provider[] = [
        new MempoolSpaceProvider(),
        new BlockchairProvider(
          blockchairApiKey ? { apiKey: blockchairApiKey } : undefined
        ),
      ];

      cascade = new ProviderCascade(providers, {
        maxRetries: 3,
        retryDelayMs: 50,
        timeoutMs: 10000,
        concurrencyLimit: 5,
      });
    } else if (chain === 'ethereum') {
      const etherscanKeys = loadEtherscanKeysFromEnv();
      const providers: Provider[] = [];

      // API-first strategy for multi-user reliability under RPC instability.
      if (etherscanKeys.length > 0) {
        providers.push(
          new EtherscanProvider({
            keys: etherscanKeys,
            rotationStrategy: 'round-robin',
            shuffleOnStartup: true,
          })
        );
      }

      // RPC is intentionally the final fallback attempt.
      providers.push(new EthereumPublicRpcProvider());

      cascade = new ProviderCascade(providers, {
        maxRetries: 3,
        retryDelayMs: 50,
        timeoutMs: 10000,
        concurrencyLimit: 5,
      });
    } else {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNSUPPORTED_CHAIN',
          message: `Unsupported chain: ${chain}`,
        },
      };
      return withSession(NextResponse.json(errorResponse, { status: 400 }));
    }

    // Fetch transaction with cascade
    const result = await cascade.fetchTransaction(txHash);
    const canonicalDataResult = CanonicalTxDataSchema.safeParse(result.data);
    if (!canonicalDataResult.success) {
      throw new Error('Provider returned invalid canonical data');
    }

    // Sign canonical data
    const signer = getCachedOracleSignerFromEnv();
    const messageHash = await computeOracleCommitment(canonicalDataResult.data);
    const signedPayload: OraclePayloadV1 = {
      ...canonicalDataResult.data,
      messageHash,
      oracleSignature: signer.sign(messageHash),
      oraclePubKeyId: signer.getPublicKeyId(),
      schemaVersion: 'v1',
      signedAt: Math.floor(Date.now() / 1000),
    };

    // Return signed payload
    return withSession(NextResponse.json({
      data: signedPayload,
      cached: result.cached,
    }));
  } catch (error) {
    if (reservedReplayKey) {
      replayProtection.release(reservedReplayKey);
    }

    secureError('[Oracle API] Error:', error);

    const mapped = mapErrorToResponse(error);

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

export { mapErrorToResponse };

export function __disposeOracleFetchRouteForTests(): void {
  rateLimiter.dispose();
  globalRateLimiter.dispose();
  replayProtection.dispose();
  resetCachedOracleSignerForTests();
}
