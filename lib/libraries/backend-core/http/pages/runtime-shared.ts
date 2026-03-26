import { type ZodType } from 'zod';
import { getClientIdentifier } from '../../../../security/rate-limit';
import { sanitizeAndValidateJsonInput } from '../../../../security/json-input-sanitizer';
import { type ErrorCode } from '../../../../validation/schemas';

export interface PagesFunctionContextLike {
  env?: Record<string, unknown>;
  request: Request;
}

interface JsonErrorPayload {
  error: {
    code: ErrorCode;
    details?: Record<string, unknown>;
    message: string;
  };
}

interface JsonBodyParseResult {
  ok: true;
  data: unknown;
}

interface JsonBodyParseError {
  ok: false;
  response: Response;
}

export interface FunctionRouteRateLimiters {
  clientLimiter: SimpleRateLimiter;
  clientLimit: number;
  globalLimiter: SimpleRateLimiter;
  globalLimit: number;
  clientBurstLimiter?: SimpleRateLimiter;
  clientBurstLimit?: number;
  globalBurstLimiter?: SimpleRateLimiter;
  globalBurstLimit?: number;
}

export interface CreateFunctionRouteRateLimitersOptions {
  clientMaxRequests: number;
  globalMaxRequests: number;
  windowMs: number;
  clientBurstMaxRequests?: number;
  globalBurstMaxRequests?: number;
  burstWindowMs?: number;
}

export interface FunctionRouteRateLimitMessages {
  client: string;
  global: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
} as const;
const MAX_JSON_DEPTH = 40;
const MAX_JSON_NODES = 10000;
const DEFAULT_PARSE_MESSAGE_PREFIXES = [
  'Payload too large',
  'Invalid Content-Type',
  'Empty request body',
  'JSON object too complex',
  'JSON nesting too deep',
  'JSON string contains unsafe control characters',
  'JSON string contains invisible Unicode characters',
  'JSON key contains leading or trailing whitespace',
  'JSON key contains unsafe control characters',
  'JSON key contains invisible Unicode characters',
  'Potentially malicious JSON structure detected',
] as const;

function getUtf8ByteLength(value: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(value, 'utf8');
  }

  return new TextEncoder().encode(value).byteLength;
}

class SimpleRateLimiter {
  private readonly maxRequests: number;
  private readonly maxStoreSize: number;
  private readonly store = new Map<string, { count: number; resetAt: number }>();
  private readonly windowMs: number;

  constructor({
    maxRequests,
    windowMs,
    maxStoreSize = 5000,
  }: {
    maxRequests: number;
    windowMs: number;
    maxStoreSize?: number;
  }) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxStoreSize = maxStoreSize;
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    this.cleanupExpiredEntries(now);

    const existing = this.store.get(identifier);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs;
      this.store.set(identifier, { count: 1, resetAt });
      this.evictOverflowEntries();
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - existing.count,
      resetAt: existing.resetAt,
    };
  }

  private cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  private evictOverflowEntries(): void {
    if (this.store.size <= this.maxStoreSize) {
      return;
    }

    const evictionCount = Math.max(
      this.store.size - this.maxStoreSize,
      Math.floor(this.maxStoreSize * 0.2)
    );
    const sortedByResetAt = Array.from(this.store.entries())
      .sort((a, b) => a[1].resetAt - b[1].resetAt);

    for (const [key] of sortedByResetAt.slice(0, evictionCount)) {
      this.store.delete(key);
    }
  }
}

function createJsonPayload(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): JsonErrorPayload {
  return {
    error: {
      code,
      ...(details ? { details } : {}),
      message,
    },
  };
}

export function attachCorsHeaders(response: Response): Response {
  response.headers.set(
    'Access-Control-Allow-Headers',
    CORS_HEADERS['Access-Control-Allow-Headers']
  );
  response.headers.set(
    'Access-Control-Allow-Methods',
    CORS_HEADERS['Access-Control-Allow-Methods']
  );
  response.headers.set(
    'Access-Control-Allow-Origin',
    CORS_HEADERS['Access-Control-Allow-Origin']
  );
  return response;
}

export function jsonResponse(status: number, payload: unknown): Response {
  return attachCorsHeaders(
    new Response(JSON.stringify(payload), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
      status,
    })
  );
}

export function jsonErrorResponse({
  code,
  details,
  headers,
  message,
  status,
}: {
  code: ErrorCode;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
  message: string;
  status: number;
}): Response {
  const response = jsonResponse(status, createJsonPayload(code, message, details));
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export function createRateLimitResponse(
  limit: number,
  message: string,
  resetAt: number
): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return jsonErrorResponse({
    code: 'RATE_LIMIT_EXCEEDED',
    details: {
      limit,
      resetAt: new Date(resetAt).toISOString(),
      retryAfterSeconds,
    },
    headers: {
      'Retry-After': String(retryAfterSeconds),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(resetAt).toISOString(),
    },
    message,
    status: 429,
  });
}

function syncEnvBindingsToProcessEnv(
  envBindings: Record<string, unknown> | undefined
): void {
  if (!envBindings || typeof process === 'undefined' || !process.env) {
    return;
  }

  for (const [key, value] of Object.entries(envBindings)) {
    if (typeof value !== 'string') {
      continue;
    }

    process.env[key] = value;
  }
}

function mapParseErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Invalid JSON request body';
  }

  if (DEFAULT_PARSE_MESSAGE_PREFIXES.some((prefix) => error.message.startsWith(prefix))) {
    return error.message;
  }

  return 'Invalid JSON request body';
}

export function parsePositiveIntEnv(key: string, fallback: number): number {
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

export function prepareRequestContext(
  context: PagesFunctionContextLike
): { ok: true; request: Request } | { ok: false; response: Response } {
  syncEnvBindingsToProcessEnv(context.env);
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return {
      ok: false,
      response: attachCorsHeaders(new Response(null, { status: 204 })),
    };
  }

  if (request.method !== 'POST') {
    return {
      ok: false,
      response: jsonResponse(405, { error: 'Method not allowed' }),
    };
  }

  return { ok: true, request };
}

export async function parseJsonBodyWithLimits(
  request: Request,
  maxSizeBytes: number
): Promise<JsonBodyParseResult | JsonBodyParseError> {
  const contentType = request.headers.get('content-type');
  if (contentType) {
    const normalizedType = (contentType.split(';')[0] ?? '').trim().toLowerCase();
    if (normalizedType !== 'application/json' && normalizedType !== 'text/plain') {
      return {
        ok: false,
        response: jsonErrorResponse({
          code: 'INVALID_HASH',
          message: `Invalid Content-Type: ${contentType}`,
          status: 400,
        }),
      };
    }
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (!Number.isFinite(size) || size < 0 || size > maxSizeBytes) {
      return {
        ok: false,
        response: jsonErrorResponse({
          code: 'INVALID_HASH',
          message: `Payload too large: ${size} bytes (max: ${maxSizeBytes})`,
          status: 400,
        }),
      };
    }
  }

  const text = await request.text();
  const textByteLength = getUtf8ByteLength(text);
  if (textByteLength > maxSizeBytes) {
    return {
      ok: false,
      response: jsonErrorResponse({
        code: 'INVALID_HASH',
        message: `Payload too large: ${textByteLength} bytes (max: ${maxSizeBytes})`,
        status: 400,
      }),
    };
  }
  if (textByteLength === 0) {
    return {
      ok: false,
      response: jsonErrorResponse({
        code: 'INVALID_HASH',
        message: 'Empty request body',
        status: 400,
      }),
    };
  }

  try {
    const parsed = JSON.parse(text);
    const sanitized = sanitizeAndValidateJsonInput(parsed, {
      maxDepth: MAX_JSON_DEPTH,
      maxNodes: MAX_JSON_NODES,
    });
    return {
      ok: true,
      data: sanitized,
    };
  } catch (error) {
    const message = error instanceof SyntaxError
      ? 'Invalid JSON syntax'
      : mapParseErrorMessage(error);
    return {
      ok: false,
      response: jsonErrorResponse({
        code: 'INVALID_HASH',
        message,
        status: 400,
      }),
    };
  }
}

export function validateRequestBody<T>(
  body: unknown,
  schema: ZodType<T>,
  invalidRequestMessage: string
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    response: jsonErrorResponse({
      code: 'INVALID_HASH',
      details: parsed.error.flatten() as unknown as Record<string, unknown>,
      message: invalidRequestMessage,
      status: 400,
    }),
  };
}

export function createFunctionRouteRateLimiters({
  clientMaxRequests,
  globalMaxRequests,
  windowMs,
  clientBurstMaxRequests,
  globalBurstMaxRequests,
  burstWindowMs = 1000,
}: CreateFunctionRouteRateLimitersOptions): FunctionRouteRateLimiters {
  const limiters: FunctionRouteRateLimiters = {
    clientLimit: clientMaxRequests,
    clientLimiter: new SimpleRateLimiter({
      maxRequests: clientMaxRequests,
      windowMs,
    }),
    globalLimit: globalMaxRequests,
    globalLimiter: new SimpleRateLimiter({
      maxRequests: globalMaxRequests,
      windowMs,
    }),
  };

  if (
    clientBurstMaxRequests !== undefined &&
    clientBurstMaxRequests > 0 &&
    burstWindowMs > 0
  ) {
    limiters.clientBurstLimit = clientBurstMaxRequests;
    limiters.clientBurstLimiter = new SimpleRateLimiter({
      maxRequests: clientBurstMaxRequests,
      windowMs: burstWindowMs,
    });
  }

  if (
    globalBurstMaxRequests !== undefined &&
    globalBurstMaxRequests > 0 &&
    burstWindowMs > 0
  ) {
    limiters.globalBurstLimit = globalBurstMaxRequests;
    limiters.globalBurstLimiter = new SimpleRateLimiter({
      maxRequests: globalBurstMaxRequests,
      windowMs: burstWindowMs,
    });
  }

  return limiters;
}

export function checkFunctionRouteRateLimits({
  request,
  messages,
  limiters,
  globalScopeKey = 'global',
}: {
  request: Request;
  messages: FunctionRouteRateLimitMessages;
  limiters: FunctionRouteRateLimiters;
  globalScopeKey?: string;
}): { ok: true; clientId: string | null } | { ok: false; response: Response } {
  const clientId = getClientIdentifier(request);
  const clientScopeKey = clientId ?? 'anonymous';

  if (limiters.globalBurstLimiter && limiters.globalBurstLimit !== undefined) {
    const result = limiters.globalBurstLimiter.check(globalScopeKey);
    if (!result.allowed) {
      return {
        ok: false,
        response: createRateLimitResponse(
          limiters.globalBurstLimit,
          messages.global,
          result.resetAt
        ),
      };
    }
  }

  const globalResult = limiters.globalLimiter.check(globalScopeKey);
  if (!globalResult.allowed) {
    return {
      ok: false,
      response: createRateLimitResponse(
        limiters.globalLimit,
        messages.global,
        globalResult.resetAt
      ),
    };
  }

  if (limiters.clientBurstLimiter && limiters.clientBurstLimit !== undefined) {
    const result = limiters.clientBurstLimiter.check(clientScopeKey);
    if (!result.allowed) {
      return {
        ok: false,
        response: createRateLimitResponse(
          limiters.clientBurstLimit,
          messages.client,
          result.resetAt
        ),
      };
    }
  }

  const clientResult = limiters.clientLimiter.check(clientScopeKey);
  if (!clientResult.allowed) {
    return {
      ok: false,
      response: createRateLimitResponse(
        limiters.clientLimit,
        messages.client,
        clientResult.resetAt
      ),
    };
  }

  return { ok: true, clientId };
}

export function readCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookiePairs = cookieHeader.split(';');
  for (const pair of cookiePairs) {
    const trimmed = pair.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!rawValue) {
      return null;
    }

    return decodeURIComponent(rawValue);
  }

  return null;
}

export function appendSetCookie(response: Response, cookieValue: string | null): Response {
  if (!cookieValue) {
    return response;
  }

  response.headers.append('Set-Cookie', cookieValue);
  return response;
}
