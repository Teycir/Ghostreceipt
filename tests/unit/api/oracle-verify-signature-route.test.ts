import { NextRequest } from 'next/server';
import { POST } from '@/app/api/oracle/verify-signature/route';
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

  it('returns valid=true for matching signature and key id', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const messageHash = '12345678901234567890';
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash,
        oracleSignature: signer.sign(messageHash),
        oraclePubKeyId: signer.getPublicKeyId(),
        signedAt: 1700000000,
      }),
    });

    const response = await POST(request);
    const data = (await response.json()) as { valid: boolean };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('returns valid=false when oraclePubKeyId does not match configured signer', async () => {
    const signer = new OracleSigner('1'.repeat(64));
    const messageHash = '12345678901234567890';
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash,
        oracleSignature: signer.sign(messageHash),
        oraclePubKeyId: 'f'.repeat(16),
        signedAt: 1700000000,
      }),
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
    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash: 'not-a-field-element',
        oracleSignature: signer.sign('12345678901234567890'),
        oraclePubKeyId: signer.getPublicKeyId(),
        signedAt: 1700000000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('verifies signatures using ORACLE_PUBLIC_KEY without private key', async () => {
    const privateKey = '1'.repeat(64);
    const signer = new OracleSigner(privateKey);
    const messageHash = '12345678901234567890';
    process.env['ORACLE_PUBLIC_KEY'] = OracleSigner.derivePublicKeyHex(privateKey);
    delete process.env['ORACLE_PRIVATE_KEY'];

    const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash,
        oracleSignature: signer.sign(messageHash),
        oraclePubKeyId: signer.getPublicKeyId(),
        signedAt: 1700000000,
      }),
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
    const messageHashA = '12345678901234567890';
    const messageHashB = '22345678901234567890';

    process.env['ORACLE_PRIVATE_KEY'] = keyA;
    const requestA = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash: messageHashA,
        oracleSignature: signerA.sign(messageHashA),
        oraclePubKeyId: signerA.getPublicKeyId(),
        signedAt: 1700000000,
      }),
    });
    const responseA = await POST(requestA);
    const dataA = (await responseA.json()) as { valid: boolean };

    process.env['ORACLE_PRIVATE_KEY'] = keyB;
    const requestB = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
      method: 'POST',
      body: JSON.stringify({
        messageHash: messageHashB,
        oracleSignature: signerB.sign(messageHashB),
        oraclePubKeyId: signerB.getPublicKeyId(),
        signedAt: 1700000001,
      }),
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
    const messageHash = '12345678901234567890';
    let lastStatus = 0;

    for (let i = 0; i < 21; i++) {
      const request = new NextRequest('http://localhost:3000/api/oracle/verify-signature', {
        method: 'POST',
        body: JSON.stringify({
          messageHash,
          oracleSignature: signer.sign(messageHash),
          oraclePubKeyId: signer.getPublicKeyId(),
          signedAt: 1700000000,
        }),
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
