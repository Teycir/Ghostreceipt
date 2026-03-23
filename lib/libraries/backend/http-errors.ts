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
  return createJsonErrorResponse({
    code: 'RATE_LIMIT_EXCEEDED',
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(resetAt).toISOString(),
    },
    message,
    status: 429,
  });
}
