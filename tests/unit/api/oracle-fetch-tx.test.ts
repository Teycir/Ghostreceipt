import { POST, __disposeOracleFetchRouteForTests } from '@/app/api/oracle/fetch-tx/route';
import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { HeliusProvider } from '@/lib/providers/solana/helius';
import { NextRequest } from 'next/server';

describe('Oracle API - /api/oracle/fetch-tx', () => {
  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  const originalEtherscanKey1 = process.env['ETHERSCAN_API_KEY_1'];
  const originalHeliusKey1 = process.env['HELIUS_API_KEY_1'];

  beforeEach(() => {
    __disposeOracleFetchRouteForTests();
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    process.env['ETHERSCAN_API_KEY_1'] = 'test-etherscan-key';
    process.env['HELIUS_API_KEY_1'] = 'test-helius-key';
  });

  afterEach(() => {
    if (originalOraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalOraclePrivateKey;
    }

    if (originalEtherscanKey1 === undefined) {
      delete process.env['ETHERSCAN_API_KEY_1'];
    } else {
      process.env['ETHERSCAN_API_KEY_1'] = originalEtherscanKey1;
    }

    if (originalHeliusKey1 === undefined) {
      delete process.env['HELIUS_API_KEY_1'];
    } else {
      process.env['HELIUS_API_KEY_1'] = originalHeliusKey1;
    }

    __disposeOracleFetchRouteForTests();
    jest.restoreAllMocks();
  });

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

    it('should reject invalid Solana tx signature format', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'solana',
          txHash: 'invalid-signature',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should reject ethereumAsset for non-ethereum chain requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'bitcoin',
          ethereumAsset: 'usdc',
          txHash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_HASH');
    });

    it('should accept valid Bitcoin request', async () => {
      jest.spyOn(BlockCypherProvider.prototype, 'fetchTransaction').mockResolvedValue({
        chain: 'bitcoin',
        txHash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        valueAtomic: '1000',
        timestampUnix: 1700000000,
        confirmations: 6,
        blockNumber: 800000,
        blockHash: 'b'.repeat(64),
      });

      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'bitcoin',
          txHash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept valid Ethereum request', async () => {
      jest.spyOn(EtherscanProvider.prototype, 'fetchTransaction').mockResolvedValue({
        chain: 'ethereum',
        txHash: '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        valueAtomic: '1000000000000000000',
        timestampUnix: 1700000000,
        confirmations: 12,
        blockNumber: 19000000,
        blockHash: `0x${'c'.repeat(64)}`,
      });

      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'ethereum',
          txHash: '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept valid Ethereum request with USDC asset mode', async () => {
      jest.spyOn(EtherscanProvider.prototype, 'fetchTransaction').mockResolvedValue({
        chain: 'ethereum',
        txHash: '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        valueAtomic: '1000000',
        timestampUnix: 1700000000,
        confirmations: 12,
        blockNumber: 19000000,
        blockHash: `0x${'c'.repeat(64)}`,
      });

      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'ethereum',
          ethereumAsset: 'usdc',
          txHash: '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept valid Solana request', async () => {
      jest.spyOn(HeliusProvider.prototype, 'fetchTransaction').mockResolvedValue({
        chain: 'solana',
        txHash: '1111111111111111111111111111111111111111111111111111111111111111',
        valueAtomic: '1000000',
        timestampUnix: 1700000000,
        confirmations: 8,
        blockNumber: 319000000,
      });

      const request = new NextRequest('http://localhost:3000/api/oracle/fetch-tx', {
        method: 'POST',
        body: JSON.stringify({
          chain: 'solana',
          txHash: '1111111111111111111111111111111111111111111111111111111111111111',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
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
