import { NextRequest, NextResponse } from 'next/server';
import {
  createJsonErrorResponse,
  resetCachedOracleSignerForTests,
} from '@/lib/libraries/backend';
import {
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  parseRateLimitedOracleRouteBody,
  VerifySignatureRequestSchema,
  verifyOracleSignature,
} from '@ghostreceipt/backend-core/http';

const routeRateLimiters = createOracleRouteRateLimiters({
  clientMaxRequests: 20,
  globalMaxRequests: 200,
  windowMs: 60000,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const envelope = await parseRateLimitedOracleRouteBody({
    invalidRequestMessage: 'Invalid signature verification request',
    maxBodySizeBytes: 1024 * 5,
    rateLimit: {
      clientMaxRequests: 20,
      globalMaxRequests: 200,
      limiters: routeRateLimiters,
      messages: {
        client: 'Too many requests. Please try again later.',
        global: 'Service is busy. Please try again later.',
      },
    },
    request,
    schema: VerifySignatureRequestSchema,
  });
  if (!envelope.ok) {
    return envelope.response;
  }

  const verification = verifyOracleSignature(envelope.data, {
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
