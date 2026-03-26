import { NextRequest, NextResponse } from 'next/server';
import { SharePointerResolveRequestSchema } from '@/lib/validation/schemas';
import { createJsonErrorResponse } from '@/lib/libraries/backend';
import {
  parseSecureJsonWithError,
  validateBodyWithSchema,
} from '@ghostreceipt/backend-core/http';
import {
  resolveSharePointerPayload,
} from '@/lib/share/share-pointer-service';

/**
 * POST /api/share-pointer/resolve
 *
 * Resolves a compact pointer ID to the original proof payload.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsedBody = await parseSecureJsonWithError(request, {
      fallbackMessage: 'Invalid share pointer resolve request body',
      maxSize: 2048,
    });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const validated = validateBodyWithSchema({
      body: parsedBody.data,
      options: {
        message: 'Invalid share pointer resolve request',
      },
      schema: SharePointerResolveRequestSchema,
    });
    if (!validated.ok) {
      return validated.response;
    }

    const { id } = validated.data;
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
