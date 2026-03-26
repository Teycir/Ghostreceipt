import { NextRequest, NextResponse } from 'next/server';
import { SharePointerCreateRequestSchema } from '@/lib/validation/schemas';
import { createJsonErrorResponse } from '@/lib/libraries/backend';
import {
  parseSecureJsonWithError,
  validateBodyWithSchema,
} from '@ghostreceipt/backend-core/http';
import {
  buildVerifySidUrl,
  storeSharePointerPayload,
} from '@/lib/share/share-pointer-service';

const CREATE_REQUEST_MAX_BODY_BYTES = 110_000;

/**
 * POST /api/share-pointer/create
 *
 * Stores a proof payload behind a short-lived pointer ID and returns
 * a compact verify URL (sid-based) suitable for QR generation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsedBody = await parseSecureJsonWithError(request, {
      fallbackMessage: 'Invalid share pointer create request body',
      maxSize: CREATE_REQUEST_MAX_BODY_BYTES,
    });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const validated = validateBodyWithSchema({
      body: parsedBody.data,
      options: {
        message: 'Invalid share pointer create request',
      },
      schema: SharePointerCreateRequestSchema,
    });
    if (!validated.ok) {
      return validated.response;
    }

    const stored = await storeSharePointerPayload(validated.data.proof);
    const verifyUrl = buildVerifySidUrl(request.url, stored.id);

    return NextResponse.json({
      data: {
        expiresAt: new Date(stored.expiresAtMs).toISOString(),
        id: stored.id,
        verifyUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create share pointer';
    return createJsonErrorResponse({
      code: 'INTERNAL_ERROR',
      message,
      status: 500,
    });
  }
}
