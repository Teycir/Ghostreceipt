import { NextRequest } from 'next/server';
import { POST, __disposeOracleVerifyRouteForTests } from '@/app/api/oracle/verify-signature/route';
import { OracleSigner } from '@/lib/oracle/signer';
import {
  __resetOracleTransparencyLogCacheForTests,
  __setOracleTransparencyLogForTests,
  createOracleTransparencyEntryHash,
} from '@ghostreceipt/backend-core/http';

describe('POST /api/oracle/verify-signature', () => {
  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  const originalOraclePublicKey = process.env['ORACLE_PUBLIC_KEY'];
  const originalTrustProxyHeaders = process.env['TRUST_PROXY_HEADERS'];

  beforeEach(() => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    process.env['TRUST_PROXY_HEADERS'] = 'true';
    __resetOracleTransparencyLogCacheForTests();
  });

  afterEach(() => {
    if (originalOraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalOraclePrivateKey;
    }

    if (originalTrustProxyHeaders === undefined) {
      delete process.env['TRUST_PROXY_HEADERS'];
    } else {
      process.env['TRUST_PROXY_HEADERS'] = originalTrustProxyHeaders;
    }

    if (originalOraclePublicKey === undefined) {
      delete process.env['ORACLE_PUBLIC_KEY'];
    } else {
      process.env['ORACLE_PUBLIC_KEY'] = originalOraclePublicKey;
    }

    __resetOracleTransparencyLogCacheForTests();
  });

  afterAll(() => {
    __disposeOracleVerifyRouteForTests();
  });

  function buildSignedAuthPayload(
    signer: OracleSigner,
    overrides: Partial<{
      expiresAt: number;
      messageHash: string;
      nonce: string;
      oraclePubKeyId: string;
      signedAt: number;
    }> = {}
  ): {
    expiresAt: number;
    messageHash: string;
    nonce: string;
    oraclePubKeyId: string;
    oracleSignature: string;
    signedAt: number;
  } {
    const nowUnix = Math.floor(Date.now() / 1000);
    const signed = signer.signAuthEnvelope({
      messageHash: overrides.messageHash ?? '12345678901234567890',
      nonce: overrides.nonce ?? 'a'.repeat(32),
      signedAt: overrides.signedAt ?? nowUnix,
      expiresAt: overrides.expiresAt ?? nowUnix + 300,
    });

    return {
      ...signed.envelope,
      oraclePubKeyId: overrides.oraclePubKeyId ?? signed.envelope.oraclePubKeyId,
      oracleSignature: signed.oracleSignature,
    };
  }

  function buildTransparencyLog(entries: Array<{
    keyId: string;
    publicKey: string;
    status: 'active' | 'retired' | 'revoked';
    validFrom: number;
    validUntil: number | null;
  }>): {
    entries: Array<{
      entryHash: string;
      index: number;
      keyId: string;
      prevEntryHash: string | null;
      publicKey: string;
      status: 'active' | 'retired' | 'revoked';
      validFrom: number;
      validUntil: number | null;
    }>;
    generatedAt: string;
    schemaVersion: 1;
  } {
    let previousHash: string | null = null;
    const builtEntries = entries.map((entry, index) => {
      const withChain = {
        index,
        keyId: entry.keyId,
        prevEntryHash: previousHash,
        publicKey: entry.publicKey,
        status: entry.status,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil,
      } as const;
      const entryHash = createOracleTransparencyEntryHash(withChain);
      previousHash = entryHash;
      return {
        ...withChain,
        entryHash,
      };
    });

    return {
      entries: builtEntries,
      generatedAt: '2026-03-23T00:00:00.000Z',
      schemaVersion: 1,
    };
  }

  it('returns valid=true for matching signature and key id', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer);
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const data = (await response.json()) as { valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('returns valid=true for matching envelope signature', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const signed = buildSignedAuthPayload(signer, { nonce: 'd'.repeat(32) });
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(signed),
    });

    const response = await POST(request);
    const data = (await response.json()) as { valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('returns valid=false for tampered envelope fields', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const signed = buildSignedAuthPayload(signer, { nonce: 'b'.repeat(32) });
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        ...signed,
        nonce: 'c'.repeat(32),
      }),
    });

    const response = await POST(request);
    const data = (await response.json()) as { valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
  });

  it('allows idempotent re-verification of identical payload', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer, { nonce: 'f'.repeat(32) });

    const responseA = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    const responseB = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );

    const bodyA = (await responseA.json()) as { valid?: boolean };
    const bodyB = (await responseB.json()) as { valid?: boolean };

    expect(responseA.status).toBe(200);
    expect(bodyA.valid).toBe(true);
    expect(responseB.status).toBe(200);
    expect(bodyB.valid).toBe(true);
  });

  it('returns 409 when nonce is reused for a different payload', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const nonce = 'e'.repeat(32);
    const firstPayload = buildSignedAuthPayload(signer, {
      messageHash: '12345678901234567890',
      nonce,
    });
    const secondPayload = buildSignedAuthPayload(signer, {
      messageHash: '22345678901234567890',
      nonce,
    });

    const firstResponse = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(firstPayload),
      })
    );
    const secondResponse = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(secondPayload),
      })
    );
    const secondBody = (await secondResponse.json()) as {
      error?: {
        code?: string;
        details?: {
          reasonCode?: string;
        };
      };
    };

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondBody.error?.code).toBe('REPLAY_DETECTED');
    expect(secondBody.error?.details?.reasonCode).toBe('NONCE_REUSE_CONFLICT');
  });

  it('returns 409 for expired signatures', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const nowUnix = Math.floor(Date.now() / 1000);
    const payload = buildSignedAuthPayload(signer, {
      expiresAt: nowUnix - 1,
      signedAt: nowUnix - 20,
    });

    const response = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    const body = (await response.json()) as {
      error?: {
        code?: string;
        details?: {
          reasonCode?: string;
        };
      };
    };

    expect(response.status).toBe(409);
    expect(body.error?.code).toBe('REPLAY_DETECTED');
    expect(body.error?.details?.reasonCode).toBe('SIGNATURE_EXPIRED');
  });

  it('returns 409 when signedAt is too far in the future', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const nowUnix = Math.floor(Date.now() / 1000);
    const payload = buildSignedAuthPayload(signer, {
      signedAt: nowUnix + 120,
      expiresAt: nowUnix + 420,
    });

    const response = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    const body = (await response.json()) as {
      error?: {
        code?: string;
        details?: {
          reasonCode?: string;
        };
      };
    };

    expect(response.status).toBe(409);
    expect(body.error?.code).toBe('REPLAY_DETECTED');
    expect(body.error?.details?.reasonCode).toBe('SIGNED_AT_IN_FUTURE');
  });

  it('returns valid=false when oraclePubKeyId does not match configured signer', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer, { oraclePubKeyId: 'f'.repeat(16) });
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const data = (await response.json()) as { valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
  });

  it('returns valid=false with KEY_REVOKED reason when key is revoked in transparency log', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer);
    const revokedLog = buildTransparencyLog([
      {
        keyId: payload.oraclePubKeyId,
        publicKey: OracleSigner.derivePublicKeyHex('1'.repeat(64)),
        status: 'revoked',
        validFrom: payload.signedAt - 100,
        validUntil: payload.signedAt + 100,
      },
    ]);
    __setOracleTransparencyLogForTests(revokedLog);

    const response = await POST(
      new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    const data = (await response.json()) as { message?: string; reason?: string; valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.reason).toBe('KEY_REVOKED');
    expect(data.message).toBe('Oracle key is revoked for this signing window');
  });

  it('returns 400 for malformed request payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash: '',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when auth envelope contains unknown fields', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer);
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        extraField: 'unexpected',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when expiresAt is not greater than signedAt', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const nowUnix = Math.floor(Date.now() / 1000);
    const payload = buildSignedAuthPayload(signer, {
      signedAt: nowUnix,
      expiresAt: nowUnix,
    });

    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 for non-numeric messageHash commitment', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer, {
      messageHash: 'not-a-field-element',
    });
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 500 config error when no oracle key is configured', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const payload = buildSignedAuthPayload(signer);
    delete process.env['ORACLE_PRIVATE_KEY'];
    delete process.env['ORACLE_PUBLIC_KEY'];

    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      error?: {
        code?: string;
      };
    };

    expect(response.status).toBe(500);
    expect(body.error?.code).toBe('INTERNAL_ERROR');
  });

  it('verifies signatures using ORACLE_PUBLIC_KEY without private key', async () => {
    const privateKey = '1'.repeat(64);
    const signer = new OracleSigner(privateKey);
    const payload = buildSignedAuthPayload(signer, { nonce: '7'.repeat(32) });
    process.env['ORACLE_PUBLIC_KEY'] = OracleSigner.derivePublicKeyHex(privateKey);
    delete process.env['ORACLE_PRIVATE_KEY'];

    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const data = (await response.json()) as { valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('refreshes cached private-key signer when ORACLE_PRIVATE_KEY changes', async () => {
    delete process.env['ORACLE_PUBLIC_KEY'];
    const nowUnix = Math.floor(Date.now() / 1000);

    const keyA = '1'.repeat(64);
    const keyB = '2'.repeat(64);
    const signerA = new OracleSigner(keyA);
    const signerB = new OracleSigner(keyB);
    const payloadA = buildSignedAuthPayload(signerA, {
      messageHash: '12345678901234567890',
      nonce: '9'.repeat(32),
    });
    const payloadB = buildSignedAuthPayload(signerB, {
      messageHash: '22345678901234567890',
      nonce: '8'.repeat(32),
      signedAt: nowUnix + 1,
      expiresAt: nowUnix + 301,
    });

    process.env['ORACLE_PRIVATE_KEY'] = keyA;
    const requestA = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payloadA),
    });
    const responseA = await POST(requestA);
    const dataA = (await responseA.json()) as { valid: boolean };

    process.env['ORACLE_PRIVATE_KEY'] = keyB;
    const requestB = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify(payloadB),
    });
    const responseB = await POST(requestB);
    const dataB = (await responseB.json()) as { valid: boolean };

    expect(responseA.status).toBe(200);
    expect(dataA.valid).toBe(true);
    expect(responseB.status).toBe(200);
    expect(dataB.valid).toBe(true);
  });

  it('returns 429 when per-client verify limit is exceeded', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    let lastStatus = 0;

    for (let i = 0; i < 21; i++) {
      const payload = buildSignedAuthPayload(signer, {
        nonce: i.toString(16).padStart(32, '0'),
      });
      const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'x-forwarded-for': '198.51.100.10',
        },
      });

      const response = await POST(request);
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });
});
