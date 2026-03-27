import { SolanaPublicRpcProvider } from '@/lib/providers/solana/public-rpc';

const sampleSignature = '1111111111111111111111111111111111111111111111111111111111111111';
const endpointOne = 'https://rpc-one.example';
const endpointTwo = 'https://rpc-two.example';

const ENV_KEYS = [
  'SOLANA_PUBLIC_RPC_URL',
  'SOLANA_PUBLIC_RPC_URLS',
  'SOLANA_PUBLIC_RPC_URL_1',
  'SOLANA_PUBLIC_RPC_URL_2',
  'SOLANA_PUBLIC_RPC_URL_3',
  'SOLANA_PUBLIC_RPC_URL_4',
  'SOLANA_PUBLIC_RPC_URL_5',
  'SOLANA_PUBLIC_RPC_URL_6',
  'SOLANA_PUBLIC_RPC_NAME',
  'SOLANA_PUBLIC_RPC_NAMES',
  'SOLANA_PUBLIC_RPC_NAME_1',
  'SOLANA_PUBLIC_RPC_NAME_2',
  'SOLANA_PUBLIC_RPC_NAME_3',
  'SOLANA_PUBLIC_RPC_REQUEST_THROTTLE_MS',
  'SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES',
  'SOLANA_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS',
  'SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRIES',
  'SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRY_DELAY_MS',
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

function makeJsonResponse(payload: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => payload,
  } as Response;
}

function makeTransactionResult(lamports: number) {
  return {
    slot: 319000000,
    blockTime: 1700000000,
    transaction: {
      message: {
        recentBlockhash: 'RecentBlockHash11111111111111111111111111111',
        instructions: [
          {
            program: 'system',
            parsed: {
              type: 'transfer',
              info: {
                lamports,
              },
            },
          },
        ],
      },
    },
    meta: {
      innerInstructions: [],
    },
  };
}

describe('SolanaPublicRpcProvider', () => {
  beforeEach(() => {
    process.env['SOLANA_PUBLIC_RPC_REQUEST_THROTTLE_MS'] = '0';
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS'] = '0';
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES'] = '0';
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRY_DELAY_MS'] = '0';
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRIES'] = '0';
    delete process.env['SOLANA_PUBLIC_RPC_URL'];
    delete process.env['SOLANA_PUBLIC_RPC_URLS'];
    delete process.env['SOLANA_PUBLIC_RPC_URL_1'];
    delete process.env['SOLANA_PUBLIC_RPC_URL_2'];
    delete process.env['SOLANA_PUBLIC_RPC_URL_3'];
    delete process.env['SOLANA_PUBLIC_RPC_URL_4'];
    delete process.env['SOLANA_PUBLIC_RPC_URL_5'];
    delete process.env['SOLANA_PUBLIC_RPC_URL_6'];
    delete process.env['SOLANA_PUBLIC_RPC_NAME'];
    delete process.env['SOLANA_PUBLIC_RPC_NAMES'];
    delete process.env['SOLANA_PUBLIC_RPC_NAME_1'];
    delete process.env['SOLANA_PUBLIC_RPC_NAME_2'];
    delete process.env['SOLANA_PUBLIC_RPC_NAME_3'];
  });

  afterEach(() => {
    restoreEnv();
    jest.restoreAllMocks();
  });

  it('cascades across numbered endpoints when an endpoint returns null transaction/status', async () => {
    process.env['SOLANA_PUBLIC_RPC_URL_1'] = endpointOne;
    process.env['SOLANA_PUBLIC_RPC_URL_2'] = endpointTwo;

    const provider = new SolanaPublicRpcProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: null,
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(2500),
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [null],
          },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [
              {
                confirmations: 7,
                confirmationStatus: 'confirmed',
              },
            ],
          },
        })
      );

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('2500');
    expect(result.confirmations).toBe(7);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      endpointOne,
      endpointTwo,
      endpointOne,
      endpointTwo,
    ]);
  });

  it('retries the same endpoint before falling back', async () => {
    process.env['SOLANA_PUBLIC_RPC_URL'] = endpointOne;
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES'] = '1';

    const provider = new SolanaPublicRpcProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeJsonResponse({}, 429, 'Too Many Requests'))
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(11),
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [
              {
                confirmations: null,
                confirmationStatus: 'finalized',
              },
            ],
          },
        })
      );

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('11');
    expect(result.confirmations).toBe(32);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe(endpointOne);
    expect(String(fetchMock.mock.calls[1]?.[0] ?? '')).toBe(endpointOne);
  });

  it('returns canonical data even when confirmation RPC lookups fail across endpoints', async () => {
    process.env['SOLANA_PUBLIC_RPC_URL_1'] = endpointOne;
    process.env['SOLANA_PUBLIC_RPC_URL_2'] = endpointTwo;

    const provider = new SolanaPublicRpcProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(99),
        })
      )
      .mockResolvedValueOnce(makeJsonResponse({}, 503, 'Service Unavailable'))
      .mockResolvedValueOnce(makeJsonResponse({}, 503, 'Service Unavailable'));

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('99');
    expect(result.confirmations).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('resolves endpoint names from central config constants', async () => {
    process.env['SOLANA_PUBLIC_RPC_NAME'] = 'PUBLICNODE';

    const provider = new SolanaPublicRpcProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(77),
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [
              {
                confirmations: 2,
                confirmationStatus: 'confirmed',
              },
            ],
          },
        })
      );

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('77');
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe('https://solana-rpc.publicnode.com');
  });

  it('prefers named endpoint config over legacy single-url override', async () => {
    process.env['SOLANA_PUBLIC_RPC_URL'] = endpointOne;
    process.env['SOLANA_PUBLIC_RPC_NAMES'] = 'MAINNET_BETA_PRIMARY,PUBLICNODE';

    const provider = new SolanaPublicRpcProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(41),
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [
              {
                confirmations: 3,
                confirmationStatus: 'confirmed',
              },
            ],
          },
        })
      );

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('41');
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe('https://api.mainnet-beta.solana.com');
  });

  it('retries transiently failing endpoints across passes while skipping null-history endpoints', async () => {
    process.env['SOLANA_PUBLIC_RPC_URL_1'] = endpointOne;
    process.env['SOLANA_PUBLIC_RPC_URL_2'] = endpointTwo;
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES'] = '0';
    process.env['SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRIES'] = '1';

    const provider = new SolanaPublicRpcProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      // Pass 1 getTransaction: endpointOne is rate-limited, endpointTwo returns null.
      .mockResolvedValueOnce(makeJsonResponse({}, 429, 'Too Many Requests'))
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: null,
        })
      )
      // Pass 2 getTransaction should retry only endpointOne and succeed.
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(55),
        })
      )
      // Confirmation lookup succeeds immediately on endpointOne.
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [
              {
                confirmations: 4,
                confirmationStatus: 'confirmed',
              },
            ],
          },
        })
      );

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('55');
    expect(result.confirmations).toBe(4);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      endpointOne,
      endpointTwo,
      endpointOne,
      endpointOne,
    ]);
  });
});
