import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';

const originalMempoolThrottleMs = process.env['MEMPOOL_REQUEST_THROTTLE_MS'];
const originalBitcoinPublicRpcUrl = process.env['BITCOIN_PUBLIC_RPC_URL'];
const originalBitcoinPublicRpcUrls = process.env['BITCOIN_PUBLIC_RPC_URLS'];
const originalBitcoinPublicRpcUrl1 = process.env['BITCOIN_PUBLIC_RPC_URL_1'];
const originalBitcoinPublicRpcUrl2 = process.env['BITCOIN_PUBLIC_RPC_URL_2'];
const originalBitcoinPublicRpcName = process.env['BITCOIN_PUBLIC_RPC_NAME'];
const originalBitcoinPublicRpcNames = process.env['BITCOIN_PUBLIC_RPC_NAMES'];
const originalBitcoinPublicRpcName1 = process.env['BITCOIN_PUBLIC_RPC_NAME_1'];
const originalBitcoinPublicRpcName2 = process.env['BITCOIN_PUBLIC_RPC_NAME_2'];
const originalBitcoinPublicRpcRetries = process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRIES'];
const originalBitcoinPublicRpcRetryDelay = process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS'];

describe('MempoolSpaceProvider', () => {
  beforeEach(() => {
    process.env['MEMPOOL_REQUEST_THROTTLE_MS'] = '0';
    process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS'] = '0';
    process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRIES'] = '0';
    delete process.env['BITCOIN_PUBLIC_RPC_URL'];
    delete process.env['BITCOIN_PUBLIC_RPC_URLS'];
    delete process.env['BITCOIN_PUBLIC_RPC_URL_1'];
    delete process.env['BITCOIN_PUBLIC_RPC_URL_2'];
    delete process.env['BITCOIN_PUBLIC_RPC_NAME'];
    delete process.env['BITCOIN_PUBLIC_RPC_NAMES'];
    delete process.env['BITCOIN_PUBLIC_RPC_NAME_1'];
    delete process.env['BITCOIN_PUBLIC_RPC_NAME_2'];
  });

  afterEach(() => {
    if (originalMempoolThrottleMs === undefined) {
      delete process.env['MEMPOOL_REQUEST_THROTTLE_MS'];
    } else {
      process.env['MEMPOOL_REQUEST_THROTTLE_MS'] = originalMempoolThrottleMs;
    }
    if (originalBitcoinPublicRpcUrl === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_URL'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_URL'] = originalBitcoinPublicRpcUrl;
    }
    if (originalBitcoinPublicRpcUrls === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_URLS'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_URLS'] = originalBitcoinPublicRpcUrls;
    }
    if (originalBitcoinPublicRpcUrl1 === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_URL_1'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_URL_1'] = originalBitcoinPublicRpcUrl1;
    }
    if (originalBitcoinPublicRpcUrl2 === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_URL_2'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_URL_2'] = originalBitcoinPublicRpcUrl2;
    }
    if (originalBitcoinPublicRpcName === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_NAME'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_NAME'] = originalBitcoinPublicRpcName;
    }
    if (originalBitcoinPublicRpcNames === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_NAMES'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_NAMES'] = originalBitcoinPublicRpcNames;
    }
    if (originalBitcoinPublicRpcName1 === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_NAME_1'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_NAME_1'] = originalBitcoinPublicRpcName1;
    }
    if (originalBitcoinPublicRpcName2 === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_NAME_2'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_NAME_2'] = originalBitcoinPublicRpcName2;
    }
    if (originalBitcoinPublicRpcRetries === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRIES'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRIES'] = originalBitcoinPublicRpcRetries;
    }
    if (originalBitcoinPublicRpcRetryDelay === undefined) {
      delete process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS'];
    } else {
      process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS'] = originalBitcoinPublicRpcRetryDelay;
    }
    jest.restoreAllMocks();
  });

  it('computes confirmation depth from current tip height for confirmed transactions', async () => {
    const provider = new MempoolSpaceProvider();

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          txid: 'a'.repeat(64),
          version: 2,
          locktime: 0,
          vin: [],
          vout: [{ value: 1000 }, { value: 2000 }],
          size: 0,
          weight: 0,
          fee: 0,
          status: {
            confirmed: true,
            block_height: 100,
            block_hash: 'b'.repeat(64),
            block_time: 1700000000,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '105',
      } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.confirmations).toBe(6);
    expect(result.valueAtomic).toBe('3000');
    expect(result.blockNumber).toBe(100);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://mempool.space/api/blocks/tip/height',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns zero confirmations for unconfirmed transactions without tip lookup', async () => {
    const provider = new MempoolSpaceProvider();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        txid: 'a'.repeat(64),
        version: 2,
        locktime: 0,
        vin: [],
        vout: [{ value: 42 }],
        size: 0,
        weight: 0,
        fee: 0,
        status: {
          confirmed: false,
        },
      }),
    } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.confirmations).toBe(0);
    expect(result.timestampUnix).toBe(1700000000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next configured endpoint on rate limit', async () => {
    process.env['BITCOIN_PUBLIC_RPC_URL_1'] = 'https://btc-one.example/api';
    process.env['BITCOIN_PUBLIC_RPC_URL_2'] = 'https://btc-two.example/api';

    const provider = new MempoolSpaceProvider();

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
          txid: 'a'.repeat(64),
          version: 2,
          locktime: 0,
          vin: [],
          vout: [{ value: 7 }],
          size: 0,
          weight: 0,
          fee: 0,
          status: {
            confirmed: false,
          },
        }),
      } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.valueAtomic).toBe('7');
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://btc-one.example/api/tx/' + 'a'.repeat(64),
      'https://btc-two.example/api/tx/' + 'a'.repeat(64),
    ]);
  });

  it('retries the same endpoint before failing over', async () => {
    process.env['BITCOIN_PUBLIC_RPC_URL'] = 'https://btc-retry.example/api';
    process.env['BITCOIN_PUBLIC_RPC_ENDPOINT_RETRIES'] = '1';

    const provider = new MempoolSpaceProvider();

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          txid: 'a'.repeat(64),
          version: 2,
          locktime: 0,
          vin: [],
          vout: [{ value: 21 }],
          size: 0,
          weight: 0,
          fee: 0,
          status: {
            confirmed: false,
          },
        }),
      } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.valueAtomic).toBe('21');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe(
      'https://btc-retry.example/api/tx/' + 'a'.repeat(64)
    );
    expect(String(fetchMock.mock.calls[1]?.[0] ?? '')).toBe(
      'https://btc-retry.example/api/tx/' + 'a'.repeat(64)
    );
  });

  it('resolves endpoint names from central config constants', async () => {
    process.env['BITCOIN_PUBLIC_RPC_NAME'] = 'MEMPOOL_EMZY_MAINNET';

    const provider = new MempoolSpaceProvider();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        txid: 'a'.repeat(64),
        version: 2,
        locktime: 0,
        vin: [],
        vout: [{ value: 42 }],
        size: 0,
        weight: 0,
        fee: 0,
        status: {
          confirmed: false,
        },
      }),
    } as Response);

    await provider.fetchTransaction('a'.repeat(64));

    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe(
      'https://mempool.emzy.de/api/tx/' + 'a'.repeat(64)
    );
  });
});
