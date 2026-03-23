import { NextRequest, NextResponse } from 'next/server';
import { getClientIdentifier } from '@/lib/security/rate-limit';
import {
  createJsonErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  checkOracleRouteRateLimits,
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  parseSecureJsonWithError,
  validateBodyWithSchema,
  VerifySignatureRequestSchema,
  verifyOracleSignature,
} from '@ghostreceipt/backend-core/http';

const routeRateLimiters = createOracleRouteRateLimiters({
  clientMaxRequests: 20,
  globalMaxRequests: 200,
  windowMs: 60000,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimitResponse = checkOracleRouteRateLimits({
    clientId,
    clientMaxRequests: 20,
    globalMaxRequests: 200,
    limiters: routeRateLimiters,
    messages: {
      client: 'Too many requests. Please try again later.',
      global: 'Service is busy. Please try again later.',
    },
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
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
  disposeOracleRouteRateLimiters(routeRateLimiters);
  resetCachedOracleSignerForTests();
}
