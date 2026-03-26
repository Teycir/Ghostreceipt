import { onRequest as onCreateSharePointer } from '@/functions/api/share-pointer/create';
import { onRequest as onResolveSharePointer } from '@/functions/api/share-pointer/resolve';

function createJsonPostRequest(path: string, body: unknown): Request {
  return new Request(`https://ghostreceipt.pages.dev${path}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

describe('Cloudflare Pages share-pointer routes', () => {
  it('returns 503 when compact-link storage is not durably configured (create)', async () => {
    const response = await onCreateSharePointer({
      request: createJsonPostRequest('/api/share-pointer/create', {
        proof: 'proof-payload-example',
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.message).toContain('missing SHARE_POINTERS_DB');
    expect(payload.error.details.requiredBinding).toBe('SHARE_POINTERS_DB');
  });

  it('returns 503 when compact-link storage is not durably configured (resolve)', async () => {
    const response = await onResolveSharePointer({
      request: createJsonPostRequest('/api/share-pointer/resolve', {
        id: 'r_AAAAAAAAAAAAAAAA',
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.message).toContain('missing SHARE_POINTERS_DB');
    expect(payload.error.details.requiredBinding).toBe('SHARE_POINTERS_DB');
  });
});
