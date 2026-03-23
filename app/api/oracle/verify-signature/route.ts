import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';
import {
  createJsonErrorResponse,
  createRateLimitErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  parseSecureJsonWithError,
  validateBodyWithSchema,
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

  const bodyResult = await parseSecureJsonWithError(request, {
    maxSize: 1024 * 5,
  });
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = validateBodyWithSchema({
    body: bodyResult.data,
    options: {
      code: 'INVALID_HASH',
      message: 'Invalid signature verification request',
    },
    schema: VerifySignatureRequestSchema,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const verification = verifyOracleSignature(parsed.data, {
    missingKeyMessage: 'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)',
  });
  if (verification.kind === 'config_error') {
    return createJsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message: verification.message,
      status: 500,
    });
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
