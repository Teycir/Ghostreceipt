import { NextRequest } from 'next/server';
import { parseSecureJson } from '@/lib/security/secure-json';

describe('parseSecureJson', () => {
  it('parses valid JSON payloads', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ chain: 'bitcoin', txHash: 'a'.repeat(64) }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const parsed = await parseSecureJson(request, { maxSize: 1024 });
    expect(parsed).toEqual({ chain: 'bitcoin', txHash: 'a'.repeat(64) });
  });

  it('rejects non-JSON content types', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ chain: 'bitcoin', txHash: 'a'.repeat(64) }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    await expect(parseSecureJson(request)).rejects.toThrow('Invalid Content-Type');
  });

  it('rejects nested prototype-pollution keys', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{"safe":{"nested":{"__proto__":{"polluted":true}}}}',
      headers: {
        'content-type': 'application/json',
      },
    });

    await expect(parseSecureJson(request)).rejects.toThrow(
      'Potentially malicious JSON structure detected'
    );
  });

  it('enforces byte-accurate payload size limits', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ value: '€'.repeat(20) }),
      headers: {
        'content-type': 'application/json',
      },
    });

    await expect(parseSecureJson(request, { maxSize: 30 })).rejects.toThrow(
      'Payload too large'
    );
  });

  it('rejects deeply nested JSON payloads', async () => {
    const root: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = root;
    for (let i = 0; i < 25; i++) {
      cursor['child'] = {};
      cursor = cursor['child'] as Record<string, unknown>;
    }

    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(root),
      headers: {
        'content-type': 'application/json',
      },
    });

    await expect(parseSecureJson(request, { maxDepth: 10 })).rejects.toThrow(
      'JSON nesting too deep'
    );
  });

  it('rejects invisible Unicode characters in string values', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'bitcoin',
        txHash: `a${'\u200B'.repeat(2)}${'b'.repeat(62)}`,
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    await expect(parseSecureJson(request)).rejects.toThrow(
      'JSON string contains invisible Unicode characters'
    );
  });

  it('rejects object keys with leading/trailing whitespace', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        ' txHash ': 'a'.repeat(64),
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    await expect(parseSecureJson(request)).rejects.toThrow(
      'JSON key contains leading or trailing whitespace'
    );
  });

  it('normalizes and trims string values', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        chain: ' bitcoin ',
        label: '\u212B',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const parsed = (await parseSecureJson(request)) as {
      chain: string;
      label: string;
    };

    expect(parsed.chain).toBe('bitcoin');
    expect(parsed.label).toBe('\u00C5');
  });
});
