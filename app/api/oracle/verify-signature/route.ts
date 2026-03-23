import { NextRequest, NextResponse } from 'next/server';
import { type ErrorResponse } from '@/lib/validation/schemas';
import { createRateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';
import { parseSecureJson } from '@/lib/security/secure-json';
import {
  createRateLimitErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  VerifySignatureRequestSchema,
  verifyOracleSignature,
} from '@ghostreceipt/backend-core/http';

const rateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
});

const globalRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 200,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const globalRateLimit = globalRateLimiter.check('global');
  if (!globalRateLimit.allowed) {
    return createRateLimitErrorResponse({
      limit: 200,
      message: 'Service is busy. Please try again later.',
      resetAt: globalRateLimit.resetAt,
    });
  }

  if (clientId) {
    const rateLimit = rateLimiter.check(clientId);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse({
        limit: 20,
        message: 'Too many requests. Please try again later.',
        resetAt: rateLimit.resetAt,
      });
    }
  }

  let body: unknown;
  try {
    body = await parseSecureJson(request, { maxSize: 1024 * 5 }); // 5KB limit
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
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const parsed = VerifySignatureRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INVALID_HASH',
        message: 'Invalid signature verification request',
        details: parsed.error.flatten(),
      },
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const verification = verifyOracleSignature(parsed.data, {
    missingKeyMessage: 'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)',
  });
  if (verification.kind === 'config_error') {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: verification.message,
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }

  return NextResponse.json({
    valid: verification.valid,
  });
}

export function __disposeOracleVerifyRouteForTests(): void {
  rateLimiter.dispose();
  globalRateLimiter.dispose();
  resetCachedOracleSignerForTests();
}
