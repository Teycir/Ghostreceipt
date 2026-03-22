import { NextRequest } from 'next/server';
import { POST } from '@/app/api/oracle/verify-signature/route';
import { OracleSigner } from '@/lib/oracle/signer';

describe('POST /api/oracle/verify-signature', () => {
  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];

  beforeEach(() => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
  });

  afterEach(() => {
    if (originalOraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalOraclePrivateKey;
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
});
