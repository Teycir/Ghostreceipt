import {
  InMemoryOracleAuthReplayAdapter,
  OracleAuthReplayRegistry,
} from '../oracle-auth-replay';
import {
  VerifySignatureRequestSchema,
  verifyOracleSignature,
} from '../verify-signature';
import {
  checkFunctionRouteRateLimits,
  createFunctionRouteRateLimiters,
  jsonErrorResponse,
  jsonResponse,
  parseJsonBodyWithLimits,
  parsePositiveIntEnv,
  prepareRequestContext,
  type PagesFunctionContextLike,
  validateRequestBody,
} from './runtime-shared';

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
  windowMs: 60_000,
  burstWindowMs: 1_000,
} as const;

const routeRateLimiters = createFunctionRouteRateLimiters(VERIFY_SIGNATURE_RATE_LIMIT);
const verifyReplayMaxEntries = parsePositiveIntEnv(
  'ORACLE_VERIFY_REPLAY_MAX_ENTRIES',
  2_000
);

const verifyReplayRegistry = new OracleAuthReplayRegistry({
  adapter: new InMemoryOracleAuthReplayAdapter({
    maxEntries: verifyReplayMaxEntries,
    startCleanupTimer: false,
  }),
  maxSignatureLifetimeSeconds: parsePositiveIntEnv(
    'ORACLE_VERIFY_MAX_SIGNATURE_LIFETIME_SECONDS',
    10 * 60
  ),
  maxFutureSkewSeconds: parsePositiveIntEnv(
    'ORACLE_VERIFY_REPLAY_MAX_FUTURE_SKEW_SECONDS',
    30
  ),
});

export async function handleOracleVerifySignaturePagesRequest(
  context: PagesFunctionContextLike
): Promise<Response> {
  const prepared = prepareRequestContext(context);
  if (!prepared.ok) {
    return prepared.response;
  }

  const rateLimit = checkFunctionRouteRateLimits({
    limiters: routeRateLimiters,
    messages: {
      client: 'Rate limit reached. Please wait and try again shortly.',
      global: 'Service is busy right now. Please wait and try again shortly.',
    },
    request: prepared.request,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const parsedBody = await parseJsonBodyWithLimits(prepared.request, 1024 * 5);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const validatedBody = validateRequestBody(
    parsedBody.data,
    VerifySignatureRequestSchema,
    'Invalid signature verification request'
  );
  if (!validatedBody.ok) {
    return validatedBody.response;
  }

  const verification = verifyOracleSignature(validatedBody.data, {
    missingKeyMessage: 'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)',
  });

  if (verification.kind === 'config_error') {
    return jsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message: verification.message,
      status: 500,
    });
  }

  if (verification.valid) {
    const replay = await verifyReplayRegistry.check({
      payload: validatedBody.data,
      scope: validatedBody.data.oraclePubKeyId,
    });

    if (!replay.allowed) {
      return jsonErrorResponse({
        code: 'REPLAY_DETECTED',
        details: {
          reasonCode: replay.reason,
        },
        message: replay.message,
        status: 409,
      });
    }
  }

  return jsonResponse(
    200,
    verification.valid
      ? {
          valid: true,
        }
      : {
          ...(verification.message ? { message: verification.message } : {}),
          ...(verification.reason ? { reason: verification.reason } : {}),
          valid: false,
        }
  );
}
