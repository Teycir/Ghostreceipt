import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';

const originalThrottleMs = process.env['ETHERSCAN_REQUEST_THROTTLE_MS'];

const makeProvider = () => new EtherscanProvider({
  keys: ['test-key'],
  rotationStrategy: 'round-robin',
  shuffleOnStartup: false,
});

const makeUsdcProvider = () => new EtherscanProvider({
  keys: ['test-key'],
  rotationStrategy: 'round-robin',
  shuffleOnStartup: false,
}, 'usdc');

describe('EtherscanProvider', () => {
  beforeEach(() => {
    process.env['ETHERSCAN_REQUEST_THROTTLE_MS'] = '0';
    EtherscanProvider.resetRuntimeMetricsForTests();
  });

  afterEach(() => {
    if (originalThrottleMs === undefined) {
      delete process.env['ETHERSCAN_REQUEST_THROTTLE_MS'];
    } else {
      process.env['ETHERSCAN_REQUEST_THROTTLE_MS'] = originalThrottleMs;
    }
    EtherscanProvider.resetRuntimeMetricsForTests();
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

  it('extracts USDC ERC-20 transfer amount from receipt logs when configured', async () => {
    const provider = makeUsdcProvider();
    const txHash = `0x${'e'.repeat(64)}`;

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
            value: '0x0',
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
            logs: [
              {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                topics: [
                  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                ],
                data: '0x00000000000000000000000000000000000000000000000000000000000f4240',
              },
            ],
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
    expect(result.valueAtomic).toBe('1000000');
    expect(result.txHash).toBe(txHash);
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

  it('starts from a random key and fails over sequentially across keys', async () => {
    const provider = new EtherscanProvider({
      keys: ['key-1', 'key-2', 'key-3'],
      rotationStrategy: 'random',
      shuffleOnStartup: false,
    });
    const txHash = `0x${'d'.repeat(64)}`;

    jest.spyOn(Math, 'random').mockReturnValue(0.4); // start at index 1 -> key-2

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)
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

    expect(result.txHash).toBe(txHash);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    const secondCallUrl = String(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(firstCallUrl).toContain('apikey=key-2');
    expect(secondCallUrl).toContain('apikey=key-3');

    const metrics = EtherscanProvider.getRuntimeMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics?.totalExecutions).toBe(1);
    expect(metrics?.totalAttempts).toBe(2);
    expect(metrics?.totalSuccesses).toBe(1);
    expect(metrics?.totalFailures).toBe(1);
    expect(metrics?.keys[1]?.failures).toBe(1);
    expect(metrics?.keys[2]?.successes).toBe(1);
  });
});
