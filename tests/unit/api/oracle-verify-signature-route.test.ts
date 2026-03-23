import { NextRequest } from 'next/server';
import { POST, __disposeOracleVerifyRouteForTests } from '@/app/api/oracle/verify-signature/route';
import { OracleSigner } from '@/lib/oracle/signer';

describe('POST /api/oracle/verify-signature', () => {
  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  const originalOraclePublicKey = process.env['ORACLE_PUBLIC_KEY'];
  const originalTrustProxyHeaders = process.env['TRUST_PROXY_HEADERS'];

  beforeEach(() => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    process.env['TRUST_PROXY_HEADERS'] = 'true';
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
    const signed = signer.signAuthEnvelope({
      messageHash: overrides.messageHash ?? '12345678901234567890',
      nonce: overrides.nonce ?? 'a'.repeat(32),
      signedAt: overrides.signedAt ?? 1700000000,
      expiresAt: overrides.expiresAt ?? 1700000300,
    });

    return {
      ...signed.envelope,
      oraclePubKeyId: overrides.oraclePubKeyId ?? signed.envelope.oraclePubKeyId,
      oracleSignature: signed.oracleSignature,
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

  it('verifies signatures using ORACLE_PUBLIC_KEY without private key', async () => {
    const privateKey = '1'.repeat(64);
    const signer = new OracleSigner(privateKey);
    const payload = buildSignedAuthPayload(signer);
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

    const keyA = '1'.repeat(64);
    const keyB = '2'.repeat(64);
    const signerA = new OracleSigner(keyA);
    const signerB = new OracleSigner(keyB);
    const payloadA = buildSignedAuthPayload(signerA, {
      messageHash: '12345678901234567890',
    });
    const payloadB = buildSignedAuthPayload(signerB, {
      messageHash: '22345678901234567890',
      nonce: 'b'.repeat(32),
      signedAt: 1700000001,
      expiresAt: 1700000301,
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
