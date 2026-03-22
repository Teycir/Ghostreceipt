import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';

const makeProvider = () => new EtherscanProvider({
  keys: ['test-key'],
  rotationStrategy: 'round-robin',
  shuffleOnStartup: false,
});

describe('EtherscanProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses v2 proxy endpoints and normalizes hex payloads', async () => {
    const provider = makeProvider();
    const txHash = `0x${'a'.repeat(64)}`;

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            hash: txHash,
            value: '0xde0b6b3a7640000',
            blockNumber: '0x10',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            blockNumber: '0x10',
            status: '0x1',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: '0x14',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            timestamp: '0x5f5e100',
          },
        }),
      } as Response);

    const result = await provider.fetchTransaction(txHash);

    expect(result.chain).toBe('ethereum');
    expect(result.txHash).toBe(txHash);
    expect(result.valueAtomic).toBe('1000000000000000000');
    expect(result.blockNumber).toBe(16);
    expect(result.confirmations).toBe(5);
    expect(result.timestampUnix).toBe(100000000);

    const firstCallUrl = fetchMock.mock.calls[0]?.[0];
    expect(typeof firstCallUrl).toBe('string');
    expect(firstCallUrl as string).toContain('https://api.etherscan.io/v2/api');
    expect(firstCallUrl as string).toContain('chainid=1');
    expect(firstCallUrl as string).toContain('module=proxy');
    expect(firstCallUrl as string).toContain('action=eth_getTransactionByHash');
  });

  it('marks reverted transactions as non-retryable reverted errors', async () => {
    const provider = makeProvider();
    const txHash = `0x${'b'.repeat(64)}`;

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            hash: txHash,
            value: '0x1',
            blockNumber: '0x10',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            blockNumber: '0x10',
            status: '0x0',
          },
        }),
      } as Response);

    await expect(provider.fetchTransaction(txHash)).rejects.toMatchObject({
      message: `Transaction reverted: ${txHash}`,
      code: 'REVERTED',
      retryable: false,
    });
  });

  it('surfaces Etherscan status errors from proxy responses', async () => {
    const provider = makeProvider();

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        status: '0',
        message: 'NOTOK',
      }),
    } as Response);

    await expect(
      provider.fetchTransaction(`0x${'c'.repeat(64)}`)
    ).rejects.toThrow('Etherscan error: NOTOK');
  });
});
