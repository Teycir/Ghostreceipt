import { POST } from '@/app/api/oracle/fetch-tx/route';
import { NextRequest } from 'next/server';

describe('Oracle API - /api/oracle/fetch-tx', () => {
  describe('Input Validation', () => {
    it('should reject missing chain parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          txHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should reject missing txHash parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'bitcoin',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should reject invalid chain value', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'invalid-chain',
          txHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should reject invalid Bitcoin tx hash format', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'bitcoin',
          txHash: 'invalid-hash',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should reject invalid Ethereum tx hash format', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'ethereum',
          txHash: '0123456789abcdef',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should accept valid Bitcoin request', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'bitcoin',
          txHash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        }),
      });

      const response = await POST(request);

      expect([200, 404, 502, 504]).toContain(response.status);
    });

    it('should accept valid Ethereum request', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'ethereum',
          txHash: '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        }),
      });

      const response = await POST(request);

      expect([200, 404, 502, 504]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle empty body', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return proper error response structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'bitcoin',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });
  });
});
