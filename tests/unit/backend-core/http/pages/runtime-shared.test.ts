import { parseJsonBodyWithLimits } from '@/lib/libraries/backend-core/http/pages/runtime-shared';

describe('parseJsonBodyWithLimits', () => {
  it('rejects non-JSON content types', async () => {
    const request = new Request('https://example.com/api/oracle/fetch-tx', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify({
        chain: 'bitcoin',
      }),
    });

    const result = await parseJsonBodyWithLimits(request, 1024 * 10);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.response.status).toBe(400);
    const body = (await result.response.json()) as {
      error?: {
        message?: string;
      };
    };
    expect(body.error?.message).toContain('Invalid Content-Type');
  });

  it('rejects invisible Unicode characters in string values', async () => {
    const request = new Request('https://example.com/api/oracle/fetch-tx', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        txHash: `a${'\u200B'}${'b'.repeat(63)}`,
      }),
    });

    const result = await parseJsonBodyWithLimits(request, 1024 * 10);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.response.status).toBe(400);
    const body = (await result.response.json()) as {
      error?: {
        message?: string;
      };
    };
    expect(body.error?.message).toBe('JSON string contains invisible Unicode characters');
  });

  it('sanitizes and trims JSON string values', async () => {
    const request = new Request('https://example.com/api/oracle/fetch-tx', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chain: ' ethereum ',
        label: '\u212B',
      }),
    });

    const result = await parseJsonBodyWithLimits(request, 1024 * 10);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const payload = result.data as {
      chain: string;
      label: string;
    };
    expect(payload.chain).toBe('ethereum');
    expect(payload.label).toBe('\u00C5');
  });
});
