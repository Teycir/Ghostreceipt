import { SharePointerCreateRequestSchema } from '../../../lib/validation/schemas';
import {
  type PagesFunctionContextLike,
  attachCorsHeaders,
  jsonErrorResponse,
  jsonResponse,
  parseJsonBodyWithLimits,
  validateRequestBody,
} from '../../../lib/libraries/backend-core/http/pages/runtime-shared';
import {
  buildVerifySidUrl,
  storeSharePointerPayload,
} from '../../../lib/share/share-pointer-service';

const CREATE_REQUEST_MAX_BODY_BYTES = 110_000;

export async function onRequest(context: PagesFunctionContextLike): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return attachCorsHeaders(new Response(null, { status: 204 }));
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const parsed = await parseJsonBodyWithLimits(request, CREATE_REQUEST_MAX_BODY_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  const validated = validateRequestBody(
    parsed.data,
    SharePointerCreateRequestSchema,
    'Invalid share pointer create request'
  );
  if (!validated.ok) {
    return validated.response;
  }

  try {
    const stored = await storeSharePointerPayload(validated.data.proof, context.env);
    const verifyUrl = buildVerifySidUrl(request.url, stored.id);

    return jsonResponse(200, {
      data: {
        expiresAt: new Date(stored.expiresAtMs).toISOString(),
        id: stored.id,
        verifyUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create share pointer';
    return jsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message,
      status: 500,
    });
  }
}
