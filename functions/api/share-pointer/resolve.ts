import {
  SharePointerResolveRequestSchema,
} from '../../../lib/validation/schemas';
import {
  type PagesFunctionContextLike,
  attachCorsHeaders,
  jsonErrorResponse,
  jsonResponse,
  parseJsonBodyWithLimits,
  validateRequestBody,
} from '../../../lib/libraries/backend-core/http/pages/runtime-shared';
import {
  resolveSharePointerPayload,
} from '../../../lib/share/share-pointer-service';

export async function onRequest(context: PagesFunctionContextLike): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return attachCorsHeaders(new Response(null, { status: 204 }));
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const parsed = await parseJsonBodyWithLimits(request, 2048);
  if (!parsed.ok) {
    return parsed.response;
  }

  const validated = validateRequestBody(
    parsed.data,
    SharePointerResolveRequestSchema,
    'Invalid share pointer resolve request'
  );
  if (!validated.ok) {
    return validated.response;
  }

  try {
    const pointerId = validated.data.id;
    const resolved = await resolveSharePointerPayload(pointerId, context.env);
    if (resolved.reason === null) {
      return jsonResponse(200, {
        data: {
          id: pointerId,
          proof: resolved.payload,
        },
      });
    }

    if (resolved.reason === 'EXPIRED') {
      return jsonErrorResponse({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Share pointer has expired',
        status: 410,
      });
    }

    return jsonErrorResponse({
      code: 'TRANSACTION_NOT_FOUND',
      message: 'Share pointer was not found',
      status: 404,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve share pointer';
    return jsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message,
      status: 500,
    });
  }
}
