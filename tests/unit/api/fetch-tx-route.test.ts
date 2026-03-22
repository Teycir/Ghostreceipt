import { POST, mapErrorToResponse } from '@/app/api/oracle/fetch-tx/route';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { NextRequest } from 'next/server';

describe('mapErrorToResponse', () => {
  it('maps provider TIMEOUT code to provider timeout response', () => {
    const error = Object.assign(new Error('Provider timed out'), {
      code: 'TIMEOUT',
    });
    const mapped = mapErrorToResponse(error);

    expect(mapped).toEqual({
      code: 'PROVIDER_TIMEOUT',
      message: 'Provider timed out',
      status: 504,
    });
  });

  it('maps case-insensitive rate limit message to RATE_LIMIT_EXCEEDED', () => {
    const mapped = mapErrorToResponse(new Error('Rate Limit Exceeded'));

    expect(mapped).toEqual({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate Limit Exceeded',
      status: 429,
    });
  });

  it('maps provider error code to PROVIDER_ERROR response', () => {
    const error = Object.assign(new Error('HTTP 503: Service Unavailable'), {
      code: 'PROVIDER_ERROR',
    });
    const mapped = mapErrorToResponse(error);

    expect(mapped).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'HTTP 503: Service Unavailable',
      status: 502,
    });
  });

  it('maps reverted provider error code to TRANSACTION_REVERTED response', () => {
    const error = Object.assign(new Error('Transaction reverted'), {
      code: 'REVERTED',
    });
    const mapped = mapErrorToResponse(error);

    expect(mapped).toEqual({
      code: 'TRANSACTION_REVERTED',
      message: 'Transaction reverted',
      status: 422,
    });
  });
});

describe('POST /api/oracle/fetch-tx', () => {
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

    jest.restoreAllMocks();
  });

  it('returns 400 for invalid ethereum tx hash before provider calls', async () => {
    const request = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'ethereum',
        txHash: 'invalid-hash',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_HASH');
    expect(body.error.message).toBe('Invalid request parameters');
  });

  it('returns 400 for malformed JSON request bodies', async () => {
    const request = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: '{"chain":"ethereum",',
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_HASH');
    expect(body.error.message).toBe('Invalid JSON request body');
  });

  it('returns 422 for reverted ethereum transactions', async () => {
    jest
      .spyOn(EthereumPublicRpcProvider.prototype, 'fetchTransaction')
      .mockRejectedValue(
        Object.assign(new Error('Transaction reverted: 0x' + 'a'.repeat(64)), {
          provider: 'ethereum-public-rpc',
          code: 'REVERTED',
          retryable: false,
        })
      );

    const request = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'ethereum',
        txHash: `0x${'a'.repeat(64)}`,
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('TRANSACTION_REVERTED');
  });

  it('returns 409 when the same idempotency key is replayed by the same client', async () => {
    jest.spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction').mockResolvedValue({
      chain: 'bitcoin',
      txHash: 'a'.repeat(64),
      valueAtomic: '1000',
      timestampUnix: 1700000000,
      confirmations: 12,
      blockNumber: 123456,
      blockHash: 'b'.repeat(64),
    });

    const requestPayload = JSON.stringify({
      chain: 'bitcoin',
      txHash: 'a'.repeat(64),
      idempotencyKey: 'idem-key-1',
    });

    const firstRequest = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: requestPayload,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'fetch-tx-route-test-suite',
      },
    });

    const firstResponse = await POST(firstRequest);
    const setCookie = firstResponse.headers.get('set-cookie');
    const sessionCookie = setCookie?.split(';')[0];

    const secondRequest = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: requestPayload,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'fetch-tx-route-test-suite',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
    });

    const secondResponse = await POST(secondRequest);
    const secondBody = (await secondResponse.json()) as {
      error: { code: string; message: string };
    };

    expect(sessionCookie).toMatch(/^gr_sid=/);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondBody.error.code).toBe('REPLAY_DETECTED');
  });

  it('allows retry with same idempotency key after transient failure', async () => {
    let invocationCount = 0;
    jest.spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction').mockImplementation(async () => {
      invocationCount += 1;

      // The route config uses maxRetries=3, so first request can attempt up to 4 times.
      if (invocationCount <= 4) {
        throw new Error('Provider timeout');
      }

      return {
        chain: 'bitcoin',
        txHash: 'a'.repeat(64),
        valueAtomic: '1000',
        timestampUnix: 1700000000,
        confirmations: 12,
        blockNumber: 123456,
        blockHash: 'b'.repeat(64),
      };
    });

    const requestPayload = JSON.stringify({
      chain: 'bitcoin',
      txHash: 'a'.repeat(64),
      idempotencyKey: 'idem-retry-1',
    });

    const firstRequest = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: requestPayload,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'fetch-tx-route-test-suite',
      },
    });

    const firstResponse = await POST(firstRequest);
    const setCookie = firstResponse.headers.get('set-cookie');
    const sessionCookie = setCookie?.split(';')[0];

    const secondRequest = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: requestPayload,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'fetch-tx-route-test-suite',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
    });

    const secondResponse = await POST(secondRequest);

    expect(firstResponse.status).toBe(504);
    expect(secondResponse.status).toBe(200);
  });

  it('allows same idempotency key for different anonymous sessions', async () => {
    jest.spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction').mockResolvedValue({
      chain: 'bitcoin',
      txHash: 'a'.repeat(64),
      valueAtomic: '1000',
      timestampUnix: 1700000000,
      confirmations: 12,
      blockNumber: 123456,
      blockHash: 'b'.repeat(64),
    });

    const requestPayload = JSON.stringify({
      chain: 'bitcoin',
      txHash: 'a'.repeat(64),
      idempotencyKey: 'shared-key',
    });

    const firstRequest = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: requestPayload,
      headers: {
        'content-type': 'application/json',
        cookie: 'gr_sid=session-a',
      },
    });

    const secondRequest = new NextRequest('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: requestPayload,
      headers: {
        'content-type': 'application/json',
        cookie: 'gr_sid=session-b',
      },
    });

    const firstResponse = await POST(firstRequest);
    const secondResponse = await POST(secondRequest);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
  });
});
