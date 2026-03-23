import { NextRequest } from 'next/server';
import {
  POST,
  __disposeOracleNullifierRouteForTests,
} from '@/app/api/oracle/check-nullifier/route';
import { deriveNullifier } from '@/lib/libraries/backend-core/http';

describe('POST /api/oracle/check-nullifier', () => {
  const originalTrustProxyHeaders = process.env['TRUST_PROXY_HEADERS'];

  beforeEach(() => {
    process.env['TRUST_PROXY_HEADERS'] = 'true';
  });

  afterEach(() => {
    if (originalTrustProxyHeaders === undefined) {
      delete process.env['TRUST_PROXY_HEADERS'];
    } else {
      process.env['TRUST_PROXY_HEADERS'] = originalTrustProxyHeaders;
    }
  });

  afterAll(() => {
    __disposeOracleNullifierRouteForTests();
  });

  function createRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/oracle/check-nullifier', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns first_seen on first nullifier claim', async () => {
    const response = await POST(
      createRequest({
        messageHash: '12345678901234567890',
        claimedAmount: '1000',
        minDateUnix: 1700000000,
      })
    );
    const data = (await response.json()) as {
      status?: string;
      valid?: boolean;
      nullifier?: string;
    };

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.status).toBe('first_seen');
    expect(data.nullifier).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns idempotent for identical nullifier+claim re-check', async () => {
    const body = {
      messageHash: '22345678901234567890',
      claimedAmount: '1000',
      minDateUnix: 1700000000,
    };

    const first = await POST(createRequest(body));
    const second = await POST(createRequest(body));
    const secondData = (await second.json()) as { status?: string; valid?: boolean };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondData.valid).toBe(true);
    expect(secondData.status).toBe('idempotent');
  });

  it('returns 409 conflict for same nullifier with different claim', async () => {
    const messageHash = '32345678901234567890';

    const first = await POST(
      createRequest({
        messageHash,
        claimedAmount: '1000',
        minDateUnix: 1700000000,
      })
    );
    const second = await POST(
      createRequest({
        messageHash,
        claimedAmount: '999',
        minDateUnix: 1700000000,
      })
    );
    const body = (await second.json()) as {
      error?: {
        code?: string;
        details?: {
          reasonCode?: string;
        };
      };
    };

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(body.error?.code).toBe('NULLIFIER_CONFLICT');
    expect(body.error?.details?.reasonCode).toBe('NULLIFIER_CLAIM_CONFLICT');
  });

  it('returns 400 when provided nullifier does not match message hash', async () => {
    const messageHash = '42345678901234567890';
    const mismatchedNullifier = deriveNullifier('99999999999999999999');

    const response = await POST(
      createRequest({
        messageHash,
        nullifier: mismatchedNullifier,
        claimedAmount: '1000',
        minDateUnix: 1700000000,
      })
    );
    const body = (await response.json()) as {
      error?: {
        code?: string;
      };
    };

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe('INVALID_HASH');
  });
});
