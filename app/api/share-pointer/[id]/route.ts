import { NextRequest, NextResponse } from 'next/server';
import { createJsonErrorResponse } from '@/lib/libraries/backend';
import {
  isLikelySharePointerId,
  resolveSharePointerPayload,
} from '@/lib/share/share-pointer-service';

interface SharePointerRouteContext {
  params: Promise<{ id: string }> | { id: string };
}

async function readPointerId(context: SharePointerRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

/**
 * GET /api/share-pointer/:id
 *
 * Resolves a compact pointer ID to the original proof payload.
 */
export async function GET(
  _request: NextRequest,
  context: SharePointerRouteContext
): Promise<NextResponse> {
  try {
    const id = (await readPointerId(context)).trim();
    if (!isLikelySharePointerId(id)) {
      return createJsonErrorResponse({
        code: 'INVALID_HASH',
        message: 'Invalid share pointer id',
        status: 400,
      });
    }

    const resolved = await resolveSharePointerPayload(id);
    if (resolved.reason === null) {
      return NextResponse.json({
        data: {
          id,
          proof: resolved.payload,
        },
      });
    }

    if (resolved.reason === 'EXPIRED') {
      return createJsonErrorResponse({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Share pointer has expired',
        status: 410,
      });
    }

    return createJsonErrorResponse({
      code: 'TRANSACTION_NOT_FOUND',
      message: 'Share pointer was not found',
      status: 404,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve share pointer';
    return createJsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message,
      status: 500,
    });
  }
}
