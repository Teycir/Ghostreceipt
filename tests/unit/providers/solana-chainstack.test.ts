import { SolanaChainstackProvider } from '@/lib/providers/solana/chainstack';

const sampleSignature = '1111111111111111111111111111111111111111111111111111111111111111';

const ENV_KEYS = [
  'SOLANA_PROVIDER_CHAINSTACK_MAINNET_URL',
  'SOLANA_CHAINSTACK_REQUEST_THROTTLE_MS',
  'SOLANA_CHAINSTACK_ENDPOINT_RETRIES',
  'SOLANA_CHAINSTACK_ENDPOINT_RETRY_DELAY_MS',
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

describe('SolanaChainstackProvider', () => {
  beforeEach(() => {
    process.env['SOLANA_CHAINSTACK_REQUEST_THROTTLE_MS'] = '0';
    process.env['SOLANA_CHAINSTACK_ENDPOINT_RETRIES'] = '0';
    process.env['SOLANA_CHAINSTACK_ENDPOINT_RETRY_DELAY_MS'] = '0';
  });

  afterEach(() => {
    restoreEnv();
    jest.restoreAllMocks();
  });

  it('resolves canonical Solana transfer data from Chainstack RPC', async () => {
    const provider = new SolanaChainstackProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
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
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toBe(
      'https://solana-mainnet.core.chainstack.com/test'
    );
  });

  it('retries transient upstream failures', async () => {
    process.env['SOLANA_CHAINSTACK_ENDPOINT_RETRIES'] = '1';

    const provider = new SolanaChainstackProvider();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeJsonResponse({}, 429, 'Too Many Requests'))
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: makeTransactionResult(111),
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [{ confirmationStatus: 'finalized', confirmations: null }],
          },
        })
      );

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('111');
    expect(result.confirmations).toBe(32);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('detects endpoint configuration presence', () => {
    expect(SolanaChainstackProvider.isConfigured()).toBe(true);
    delete process.env['SOLANA_PROVIDER_CHAINSTACK_MAINNET_URL'];
    expect(SolanaChainstackProvider.isConfigured()).toBe(false);
  });
});
