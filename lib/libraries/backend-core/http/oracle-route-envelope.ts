import { type NextRequest, type NextResponse } from 'next/server';
import { type ZodType } from 'zod';
import { getClientIdentifier } from '@/lib/security/rate-limit';
import { type ErrorCode } from '@/lib/validation/schemas';
import { checkOracleRouteRateLimits, type OracleRouteRateLimitMessages, type OracleRouteRateLimiters } from './rate-limit-envelope';
import { parseSecureJsonWithError, validateBodyWithSchema } from './request-envelope';

export interface OracleRouteBodyEnvelopeOptions<T> {
  invalidRequestMessage: string;
  maxBodySizeBytes: number;
  request: NextRequest;
  schema: ZodType<T>;
  invalidBodyMessage?: string;
  validationErrorCode?: ErrorCode;
  rateLimit: {
    clientMaxRequests: number;
    globalMaxRequests: number;
    clientBurstMaxRequests?: number;
    globalBurstMaxRequests?: number;
    limiters: OracleRouteRateLimiters;
    messages: OracleRouteRateLimitMessages;
    globalScopeKey?: string;
  };
}

export type OracleRouteBodyEnvelopeResult<T> =
  | { ok: true; clientId: string | null; data: T }
  | { ok: false; clientId: string | null; response: NextResponse };

export async function parseRateLimitedOracleRouteBody<T>({
  invalidRequestMessage,
  maxBodySizeBytes,
  request,
  schema,
  invalidBodyMessage,
  validationErrorCode = 'INVALID_HASH',
  rateLimit,
}: OracleRouteBodyEnvelopeOptions<T>): Promise<OracleRouteBodyEnvelopeResult<T>> {
  const clientId = getClientIdentifier(request);
  const rateLimitResponse = checkOracleRouteRateLimits({
    clientId,
    clientMaxRequests: rateLimit.clientMaxRequests,
    globalMaxRequests: rateLimit.globalMaxRequests,
    ...(rateLimit.clientBurstMaxRequests !== undefined
      ? { clientBurstMaxRequests: rateLimit.clientBurstMaxRequests }
      : {}),
    ...(rateLimit.globalBurstMaxRequests !== undefined
      ? { globalBurstMaxRequests: rateLimit.globalBurstMaxRequests }
      : {}),
    limiters: rateLimit.limiters,
    messages: rateLimit.messages,
    ...(rateLimit.globalScopeKey !== undefined
      ? { globalScopeKey: rateLimit.globalScopeKey }
      : {}),
  });
  if (rateLimitResponse) {
    return {
      ok: false,
      clientId,
      response: rateLimitResponse,
    };
  }

  const bodyResult = await parseSecureJsonWithError(request, {
    code: validationErrorCode,
    ...(invalidBodyMessage !== undefined ? { fallbackMessage: invalidBodyMessage } : {}),
    maxSize: maxBodySizeBytes,
  });
  if (!bodyResult.ok) {
    return {
      ok: false,
      clientId,
      response: bodyResult.response,
    };
  }

  const parsed = validateBodyWithSchema({
    body: bodyResult.data,
    options: {
      code: validationErrorCode,
      message: invalidRequestMessage,
    },
    schema,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      clientId,
      response: parsed.response,
    };
  }

  return {
    ok: true,
    clientId,
    data: parsed.data,
  };
}
