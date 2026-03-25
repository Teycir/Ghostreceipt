import { onRequest as onFetchTxRequest } from '@/functions/api/oracle/fetch-tx';
import { onRequest as onVerifySignatureRequest } from '@/functions/api/oracle/verify-signature';
import { onRequest as onCheckNullifierRequest } from '@/functions/api/oracle/check-nullifier';

function createJsonPostRequest(path: string, body: unknown): Request {
  return new Request(`https://ghostreceipt.pages.dev${path}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

function assertCorsHeaders(response: Response): void {
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
}

describe('Cloudflare Pages oracle wrappers', () => {
  beforeEach(() => {
    delete process.env['ORACLE_PRIVATE_KEY'];
  });

  it('returns CORS preflight for OPTIONS requests', async () => {
    const response = await onFetchTxRequest({
      request: new Request('https://ghostreceipt.pages.dev/api/oracle/fetch-tx', {
        method: 'OPTIONS',
      }),
    });

    expect(response.status).toBe(204);
    assertCorsHeaders(response);
  });

  it('returns 405 for non-POST methods', async () => {
    const response = await onFetchTxRequest({
      request: new Request('https://ghostreceipt.pages.dev/api/oracle/fetch-tx', {
        method: 'GET',
      }),
    });

    expect(response.status).toBe(405);
    assertCorsHeaders(response);
  });

  it('syncs env bindings and rejects invalid fetch payloads with 400', async () => {
    const response = await onFetchTxRequest({
      env: {
        ORACLE_PRIVATE_KEY: 'test_private_key',
      },
      request: createJsonPostRequest('/api/oracle/fetch-tx', {
        chain: 'bitcoin',
        txHash: '',
      }),
    });

    expect(process.env['ORACLE_PRIVATE_KEY']).toBe('test_private_key');
    expect(response.status).toBe(400);
    assertCorsHeaders(response);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_HASH');
  });

  it('rejects malformed verify-signature payloads with 400', async () => {
    const response = await onVerifySignatureRequest({
      request: createJsonPostRequest('/api/oracle/verify-signature', {
        invalid: true,
      }),
    });

    expect(response.status).toBe(400);
    assertCorsHeaders(response);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_HASH');
  });

  it('rejects malformed check-nullifier payloads with 400', async () => {
    const response = await onCheckNullifierRequest({
      request: createJsonPostRequest('/api/oracle/check-nullifier', {
        invalid: true,
      }),
    });

    expect(response.status).toBe(400);
    assertCorsHeaders(response);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_HASH');
  });
});
