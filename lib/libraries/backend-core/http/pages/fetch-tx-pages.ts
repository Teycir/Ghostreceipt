import { OracleFetchTxRequestSchema } from '../../../../validation/schemas';
import {
  appendSetCookie,
  checkFunctionRouteRateLimits,
  createFunctionRouteRateLimiters,
  jsonErrorResponse,
  jsonResponse,
  parseJsonBodyWithLimits,
  parsePositiveIntEnv,
  prepareRequestContext,
  readCookieValue,
  type PagesFunctionContextLike,
  validateRequestBody,
} from './runtime-shared';

type FetchTxModule = typeof import('../fetch-tx');

let fetchTxModulePromise: Promise<FetchTxModule> | null = null;

function ensureWorkerGlobalBinding(): void {
  const globalScope = globalThis as unknown as Record<string, unknown>;
  if (!('Worker' in globalScope)) {
    globalScope['Worker'] = class WorkerPolyfill {};
  }
}

async function getFetchTxModule(): Promise<FetchTxModule> {
  if (!fetchTxModulePromise) {
    ensureWorkerGlobalBinding();
    fetchTxModulePromise = import('../fetch-tx');
  }
  return fetchTxModulePromise;
}

const FETCH_TX_ANON_IDEMPOTENCY_COOKIE = 'gr_sid';
const IDEMPOTENCY_REPLAY_WINDOW_MS = 5 * 60 * 1000;
const IDEMPOTENCY_MAX_ENTRIES = 5_000;
const idempotencyReplayStore = new Map<string, number>();

function createAnonymousSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function buildAnonymousSessionCookie(value: string): string {
  const parts = [
    `${FETCH_TX_ANON_IDEMPOTENCY_COOKIE}=${encodeURIComponent(value)}`,
    'Max-Age=2592000',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (process.env['NODE_ENV'] === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function reserveReplayKey({
  anonymousSessionIdFromCookie,
  clientId,
  idempotencyKey,
}: {
  anonymousSessionIdFromCookie: string | null;
  clientId: string | null;
  idempotencyKey: string | undefined;
}): {
  anonymousSessionIdToSet: string | null;
  replayConflictReason: string | null;
  replayKey: string | null;
} {
  const normalizedIdempotencyKey = idempotencyKey?.trim();
  if (!normalizedIdempotencyKey) {
    return {
      anonymousSessionIdToSet: null,
      replayConflictReason: null,
      replayKey: null,
    };
  }

  const anonymousSessionId =
    anonymousSessionIdFromCookie ?? createAnonymousSessionId();
  const idempotencyScope = clientId ?? `sid:${anonymousSessionId}`;
  const anonymousSessionIdToSet =
    !clientId && !anonymousSessionIdFromCookie ? anonymousSessionId : null;
  const replayKey = `${idempotencyScope}:${normalizedIdempotencyKey}`;
  const now = Date.now();
  pruneIdempotencyReplayStore(now);
  const existingTimestamp = idempotencyReplayStore.get(replayKey);
  if (existingTimestamp && now - existingTimestamp < IDEMPOTENCY_REPLAY_WINDOW_MS) {
    return {
      anonymousSessionIdToSet,
      replayConflictReason: 'Duplicate idempotency key',
      replayKey: null,
    };
  }

  idempotencyReplayStore.set(replayKey, now);

  return {
    anonymousSessionIdToSet,
    replayConflictReason: null,
    replayKey,
  };
}

function pruneIdempotencyReplayStore(nowMs: number): void {
  for (const [key, createdAt] of idempotencyReplayStore.entries()) {
    if (nowMs - createdAt > IDEMPOTENCY_REPLAY_WINDOW_MS) {
      idempotencyReplayStore.delete(key);
    }
  }

  if (idempotencyReplayStore.size <= IDEMPOTENCY_MAX_ENTRIES) {
    return;
  }

  const sortedEntries = Array.from(idempotencyReplayStore.entries())
    .sort((a, b) => a[1] - b[1]);
  const overflowCount = idempotencyReplayStore.size - IDEMPOTENCY_MAX_ENTRIES;
  const evictionCount = Math.max(overflowCount, Math.floor(IDEMPOTENCY_MAX_ENTRIES * 0.2));

  for (const [key] of sortedEntries.slice(0, evictionCount)) {
    idempotencyReplayStore.delete(key);
  }
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
  windowMs: 60_000,
  burstWindowMs: 1_000,
} as const;

const routeRateLimiters = createFunctionRouteRateLimiters(FETCH_TX_RATE_LIMIT);

export async function handleOracleFetchTxPagesRequest(
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

  const parsedBody = await parseJsonBodyWithLimits(prepared.request, 1024 * 10);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const validatedBody = validateRequestBody(
    parsedBody.data,
    OracleFetchTxRequestSchema,
    'Invalid request parameters'
  );
  if (!validatedBody.ok) {
    return validatedBody.response;
  }

  const anonymousSessionIdFromCookie = readCookieValue(
    prepared.request,
    FETCH_TX_ANON_IDEMPOTENCY_COOKIE
  );

  const replayReservation = reserveReplayKey({
    anonymousSessionIdFromCookie,
    clientId: rateLimit.clientId,
    idempotencyKey: validatedBody.data.idempotencyKey,
  });

  if (replayReservation.replayConflictReason) {
    return appendSetCookie(
      jsonErrorResponse({
        code: 'REPLAY_DETECTED',
        message: replayReservation.replayConflictReason,
        status: 409,
      }),
      replayReservation.anonymousSessionIdToSet
        ? buildAnonymousSessionCookie(replayReservation.anonymousSessionIdToSet)
        : null
    );
  }

  try {
    const fetchTxModule = await getFetchTxModule();
    const signedResult = await fetchTxModule.fetchAndSignOracleTransaction(
      validatedBody.data.chain,
      validatedBody.data.txHash,
      {
        ...(validatedBody.data.chain === 'ethereum' && validatedBody.data.ethereumAsset
          ? { ethereumAsset: validatedBody.data.ethereumAsset }
          : {}),
      }
    );

    return appendSetCookie(
      jsonResponse(200, {
        cached: signedResult.cached,
        data: signedResult.data,
      }),
      replayReservation.anonymousSessionIdToSet
        ? buildAnonymousSessionCookie(replayReservation.anonymousSessionIdToSet)
        : null
    );
  } catch (error) {
    if (replayReservation.replayKey) {
      idempotencyReplayStore.delete(replayReservation.replayKey);
    }

    const fetchTxModule = await getFetchTxModule();
    const mapped = fetchTxModule.mapFetchTxErrorToResponse(error);
    return appendSetCookie(
      jsonErrorResponse({
        code: mapped.code,
        message: mapped.message,
        status: mapped.status,
      }),
      replayReservation.anonymousSessionIdToSet
        ? buildAnonymousSessionCookie(replayReservation.anonymousSessionIdToSet)
        : null
    );
  }
}
