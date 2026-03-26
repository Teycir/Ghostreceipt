import {
  type PagesFunctionContextLike,
  attachCorsHeaders,
  jsonErrorResponse,
  jsonResponse,
} from '../../../lib/libraries/backend-core/http/pages/runtime-shared';
import {
  hasDurableSharePointerStorage,
  isLikelySharePointerId,
  resolveSharePointerPayload,
} from '../../../lib/share/share-pointer-service';

interface SharePointerPagesContext extends PagesFunctionContextLike {
  params?: {
    id?: string;
  };
}

export async function onRequest(context: SharePointerPagesContext): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return attachCorsHeaders(new Response(null, { status: 204 }));
  }
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const pointerId = (context.params?.id ?? '').trim();
  if (!isLikelySharePointerId(pointerId)) {
    return jsonErrorResponse({
      code: 'INVALID_HASH',
      message: 'Invalid share pointer id',
      status: 400,
    });
  }

  if (!hasDurableSharePointerStorage(context.env)) {
    return jsonErrorResponse({
      code: 'INTERNAL_ERROR',
      details: {
        requiredBinding: 'SHARE_POINTERS_DB',
        storageBackend: 'memory',
      },
      message: 'Compact share links are unavailable on this deployment (missing SHARE_POINTERS_DB D1 binding).',
      status: 503,
    });
  }

  try {
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
