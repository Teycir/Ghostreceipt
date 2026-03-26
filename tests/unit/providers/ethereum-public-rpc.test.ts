import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';

const txHash = `0x${'a'.repeat(64)}`;
const endpointOne = 'https://eth-rpc-one.example';
const endpointTwo = 'https://eth-rpc-two.example';
const usdcContractAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const transferTopic0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const ENV_KEYS = [
  'ETHEREUM_PUBLIC_RPC_URL',
  'ETHEREUM_PUBLIC_RPC_URLS',
  'ETHEREUM_PUBLIC_RPC_URL_1',
  'ETHEREUM_PUBLIC_RPC_URL_2',
  'ETHEREUM_PUBLIC_RPC_NAME',
  'ETHEREUM_PUBLIC_RPC_NAMES',
  'ETHEREUM_PUBLIC_RPC_NAME_1',
  'ETHEREUM_PUBLIC_RPC_NAME_2',
  'ETHEREUM_USDC_PUBLIC_RPC_URL',
  'ETHEREUM_USDC_PUBLIC_RPC_URLS',
  'ETHEREUM_USDC_PUBLIC_RPC_URL_1',
  'ETHEREUM_USDC_PUBLIC_RPC_URL_2',
  'ETHEREUM_USDC_PUBLIC_RPC_NAME',
  'ETHEREUM_USDC_PUBLIC_RPC_NAMES',
  'ETHEREUM_USDC_PUBLIC_RPC_NAME_1',
  'ETHEREUM_USDC_PUBLIC_RPC_NAME_2',
  'ETHEREUM_PUBLIC_RPC_REQUEST_THROTTLE_MS',
  'ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRIES',
  'ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS',
] as const;

const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const original = originalEnv.get(key);
    if (original === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = original;
  }
}

function makeJsonRpcResponse(result: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => ({
      jsonrpc: '2.0',
      id: 1,
      result,
    }),
  } as Response;
}

describe('EthereumPublicRpcProvider', () => {
  beforeEach(() => {
    process.env['ETHEREUM_PUBLIC_RPC_REQUEST_THROTTLE_MS'] = '0';
    process.env['ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS'] = '0';
    process.env['ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRIES'] = '0';
    for (const key of ENV_KEYS) {
      if (
        key === 'ETHEREUM_PUBLIC_RPC_REQUEST_THROTTLE_MS' ||
        key === 'ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS' ||
        key === 'ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRIES'
      ) {
        continue;
      }
      delete process.env[key];
    }
  });

  afterEach(() => {
    restoreEnv();
    jest.restoreAllMocks();
  });

  it('fails over across configured endpoints when null results are returned', async () => {
    process.env['ETHEREUM_PUBLIC_RPC_URL_1'] = endpointOne;
    process.env['ETHEREUM_PUBLIC_RPC_URL_2'] = endpointTwo;

    const provider = new EthereumPublicRpcProvider('native');
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeJsonRpcResponse(null))
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          hash: txHash,
          value: '0x1',
          blockNumber: '0x10',
        })
      )
      .mockResolvedValueOnce(makeJsonRpcResponse(null))
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          blockNumber: '0x10',
          status: '0x1',
          logs: [],
        })
      )
      .mockResolvedValueOnce(makeJsonRpcResponse('0x20'))
      .mockResolvedValueOnce(makeJsonRpcResponse(null))
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          timestamp: '0x65f25c00',
          hash: `0x${'b'.repeat(64)}`,
        })
      );

    const result = await provider.fetchTransaction(txHash);

    expect(result.txHash).toBe(txHash);
    expect(result.valueAtomic).toBe('1');
    expect(result.confirmations).toBe(17);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      endpointOne,
      endpointTwo,
      endpointOne,
      endpointTwo,
      endpointOne,
      endpointOne,
      endpointTwo,
    ]);
  });

  it('retries the same endpoint on rate-limit before succeeding', async () => {
    process.env['ETHEREUM_PUBLIC_RPC_URL'] = endpointOne;
    process.env['ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRIES'] = '1';

    const provider = new EthereumPublicRpcProvider('native');
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          hash: txHash,
          value: '0x1',
          blockNumber: '0x10',
        })
      )
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          blockNumber: '0x10',
          status: '0x1',
          logs: [],
        })
      )
      .mockResolvedValueOnce(makeJsonRpcResponse('0x12'))
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          timestamp: '0x65f25c00',
          hash: `0x${'b'.repeat(64)}`,
        })
      );

    const result = await provider.fetchTransaction(txHash);

    expect(result.confirmations).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe(endpointOne);
    expect(String(fetchMock.mock.calls[1]?.[0] ?? '')).toBe(endpointOne);
  });

  it('resolves USDC endpoint configuration by constant name', async () => {
    process.env['ETHEREUM_USDC_PUBLIC_RPC_NAME'] = 'FLASHBOTS';
    process.env['ETHEREUM_PUBLIC_RPC_NAME'] = 'PUBLICNODE_PRIMARY';

    const provider = new EthereumPublicRpcProvider('usdc');
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          hash: txHash,
          value: '0x0',
          blockNumber: '0x10',
        })
      )
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          blockNumber: '0x10',
          status: '0x1',
          logs: [
            {
              address: usdcContractAddress,
              data: '0x00000000000000000000000000000000000000000000000000000000000f4240',
              topics: [transferTopic0],
            },
          ],
        })
      )
      .mockResolvedValueOnce(makeJsonRpcResponse('0x11'))
      .mockResolvedValueOnce(
        makeJsonRpcResponse({
          timestamp: '0x65f25c00',
          hash: `0x${'b'.repeat(64)}`,
        })
      );

    const result = await provider.fetchTransaction(txHash);

    expect(result.valueAtomic).toBe('1000000');
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe('https://rpc.flashbots.net');
  });
});
