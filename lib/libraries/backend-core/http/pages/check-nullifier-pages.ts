import {
  CheckNullifierRequestSchema,
  deriveClaimDigest,
  deriveNullifier,
  InMemoryNullifierRegistryAdapter,
  NullifierRegistry,
} from '../oracle-nullifier';
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

const routeRateLimiters = createFunctionRouteRateLimiters(NULLIFIER_RATE_LIMIT);
const nullifierMaxEntries = parsePositiveIntEnv(
  'ORACLE_NULLIFIER_MAX_ENTRIES',
  3_000
);

const nullifierRegistry = new NullifierRegistry({
  adapter: new InMemoryNullifierRegistryAdapter({
    maxEntries: nullifierMaxEntries,
    startCleanupTimer: false,
  }),
});

export async function handleOracleCheckNullifierPagesRequest(
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
    CheckNullifierRequestSchema,
    'Invalid nullifier check request'
  );
  if (!validatedBody.ok) {
    return validatedBody.response;
  }

  const { claimedAmount, messageHash, minDateUnix, nullifier } = validatedBody.data;
  const derivedNullifier = deriveNullifier(messageHash);
  if (nullifier && nullifier.toLowerCase() !== derivedNullifier.toLowerCase()) {
    return jsonErrorResponse({
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
    return jsonErrorResponse({
      code: 'NULLIFIER_CONFLICT',
      details: {
        nullifier: registryResult.nullifier,
        reasonCode: registryResult.reason,
      },
      message: registryResult.message,
      status: 409,
    });
  }

  return jsonResponse(200, {
    nullifier: registryResult.nullifier,
    status: registryResult.mode,
    valid: true,
  });
}
