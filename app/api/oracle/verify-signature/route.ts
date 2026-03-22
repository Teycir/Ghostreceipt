import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { OracleCommitmentSchema, type ErrorResponse } from '@/lib/validation/schemas';
import { OracleSigner } from '@/lib/oracle/signer';
import { createRateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';
import { parseSecureJson } from '@/lib/security/secure-json';

const rateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
});

const globalRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 200,
});

let oracleSignerCache: { privateKeyFingerprint: string; signer: OracleSigner } | null = null;

function fingerprintPrivateKey(privateKey: string): string {
  return createHash('sha256').update(privateKey).digest('hex');
}

function getOracleSignerFromPrivateKey(): OracleSigner {
  const oraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  if (!oraclePrivateKey) {
    throw new Error('Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)');
  }
  const privateKeyFingerprint = fingerprintPrivateKey(oraclePrivateKey);

  if (
    oracleSignerCache === null ||
    oracleSignerCache.privateKeyFingerprint !== privateKeyFingerprint
  ) {
    oracleSignerCache = {
      privateKeyFingerprint,
      signer: new OracleSigner(oraclePrivateKey),
    };
  }

  return oracleSignerCache.signer;
}

const VerifySignatureRequestSchema = z.object({
  messageHash: OracleCommitmentSchema,
  oracleSignature: z.string().regex(/^[a-f0-9]{128}$/i),
  oraclePubKeyId: z.string().regex(/^[a-f0-9]{16}$/i),
  signedAt: z.number().int().positive(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const globalRateLimit = globalRateLimiter.check('global');
  if (!globalRateLimit.allowed) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Service is busy. Please try again later.',
      },
    };
    return NextResponse.json(errorResponse, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': '200',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(globalRateLimit.resetAt).toISOString(),
      },
    });
  }

  if (clientId) {
    const rateLimit = rateLimiter.check(clientId);
    if (!rateLimit.allowed) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      };
      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }
  }

  let body: unknown;
  try {
    body = await parseSecureJson(request, { maxSize: 1024 * 5 }); // 5KB limit
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INVALID_HASH',
        message: error instanceof Error ? error.message : 'Invalid JSON request body',
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

  const oraclePublicKey = process.env['ORACLE_PUBLIC_KEY'];
  if (oraclePublicKey) {
    const expectedPubKeyId = OracleSigner.derivePublicKeyIdFromHex(oraclePublicKey);
    if (expectedPubKeyId !== parsed.data.oraclePubKeyId) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: OracleSigner.verifySignatureWithPublicKey(
        parsed.data.messageHash,
        parsed.data.oracleSignature,
        oraclePublicKey
      ),
    });
  }

  if (!process.env['ORACLE_PRIVATE_KEY']) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }

  const signer = getOracleSignerFromPrivateKey();
  return NextResponse.json({
    valid: signer.verifySignature(
      parsed.data.messageHash,
      parsed.data.oracleSignature,
      parsed.data.oraclePubKeyId
    ),
  });
}
