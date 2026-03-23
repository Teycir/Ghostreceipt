import { NextResponse } from 'next/server';
import type { ErrorCode, ErrorResponse } from '@/lib/validation/schemas';

interface JsonErrorOptions {
  code: ErrorCode;
  details?: unknown;
  headers?: Record<string, string>;
  message: string;
  status: number;
}

export function createJsonErrorResponse({
  code,
  details,
  headers,
  message,
  status,
}: JsonErrorOptions): NextResponse {
  const errorResponse: ErrorResponse = {
    error: {
      code,
      ...(
        details !== undefined &&
        details !== null &&
        typeof details === 'object'
          ? { details: details as Record<string, unknown> }
          : {}
      ),
      message,
    },
  };

  return NextResponse.json(
    errorResponse,
    headers ? { headers, status } : { status }
  );
}

interface RateLimitErrorOptions {
  limit: number;
  message: string;
  resetAt: number;
}

export function createRateLimitErrorResponse({
  limit,
  message,
  resetAt,
}: RateLimitErrorOptions): NextResponse {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt - Date.now()) / 1000)
  );

  return createJsonErrorResponse({
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
