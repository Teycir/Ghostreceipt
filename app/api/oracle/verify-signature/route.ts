import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ErrorResponse } from '@/lib/validation/schemas';
import { OracleSigner } from '@/lib/oracle/signer';

const VerifySignatureRequestSchema = z.object({
  messageHash: z.string().min(1),
  oracleSignature: z.string().regex(/^[a-f0-9]{64}$/i),
  oraclePubKeyId: z.string().regex(/^[a-f0-9]{16}$/i),
  signedAt: z.number().int().positive(),
});

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INVALID_HASH',
        message: 'Invalid JSON request body',
      },
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const parsed = VerifySignatureRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INVALID_HASH',
        message: 'Invalid signature verification request',
        details: parsed.error.flatten(),
      },
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const oraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  if (!oraclePrivateKey) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Oracle private key not configured',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }

  const signer = new OracleSigner(oraclePrivateKey);
  const expectedPubKeyId = signer.getPublicKeyId();
  if (expectedPubKeyId !== parsed.data.oraclePubKeyId) {
    return NextResponse.json({ valid: false });
  }

  const expectedSignature = signer.sign(parsed.data.messageHash).toLowerCase();
  const providedSignature = parsed.data.oracleSignature.toLowerCase();

  return NextResponse.json({
    valid: safeCompare(expectedSignature, providedSignature),
  });
}
