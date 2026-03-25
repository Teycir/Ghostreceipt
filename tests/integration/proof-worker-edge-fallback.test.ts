import { groth16 } from 'snarkjs';
import { ProofGenerator } from '@/lib/zk/prover';

jest.mock('snarkjs', () => ({
  groth16: {
    fullProve: jest.fn(),
    verify: jest.fn(),
  },
}));

const TEST_WITNESS = {
  chainId: '0',
  claimedAmount: '50000000',
  minDate: '1699999000',
  oracleCommitment: '12345678901234567890',
  realTimestamp: '1700000000',
  realValue: '100000000',
  txHash: Array.from({ length: 8 }, () => '1'),
};

const TEST_PATHS = {
  wasm: '/zk/receipt_js/receipt.wasm?v=test',
  zkey: '/zk/receipt_final.zkey?v=test',
  vkey: '/zk/verification_key.json?v=test',
};

describe('Proof worker edge runtime with client fallback integration', () => {
  const globalAny = globalThis as any;
  const mockedGroth16 = groth16 as unknown as {
    fullProve: jest.Mock;
    verify: jest.Mock;
  };
  let originalWindow: unknown;
  let originalWorker: unknown;

  beforeEach(() => {
    originalWindow = globalAny.window;
    originalWorker = globalAny.Worker;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete globalAny.window;
    } else {
      globalAny.window = originalWindow;
    }

    if (originalWorker === undefined) {
      delete globalAny.Worker;
    } else {
      globalAny.Worker = originalWorker;
    }

    jest.restoreAllMocks();
  });

  it('uses worker runtime when edge worker is available', async () => {
    mockedGroth16.fullProve.mockResolvedValue({
      proof: {
        pi_a: ['1', '2', '3'],
        pi_b: [['4', '5'], ['6', '7'], ['8', '9']],
        pi_c: ['10', '11', '12'],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: ['fallback-1'],
    });

    globalAny.window = {};
    globalAny.Worker = class MockWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(message: { id: number }): void {
        this.onmessage?.({
          data: {
            id: message.id,
            proof: {
              pi_a: ['11', '22', '33'],
              pi_b: [['44', '55'], ['66', '77'], ['88', '99']],
              pi_c: ['111', '222', '333'],
              protocol: 'groth16',
              curve: 'bn128',
            },
            publicSignals: ['worker-1', 'worker-2', 'worker-3'],
            type: 'prove_success',
          },
        });
      }
      terminate(): void {}
    };

    const generator = new ProofGenerator(TEST_PATHS.wasm, TEST_PATHS.zkey, TEST_PATHS.vkey);
    const result = await generator.generateProof(TEST_WITNESS);

    expect(result.publicSignals).toEqual(['worker-1', 'worker-2', 'worker-3']);
    expect(mockedGroth16.fullProve).not.toHaveBeenCalled();
  });

  it('falls back to client direct proving when edge worker runtime fails', async () => {
    const fallbackProof = {
      proof: {
        pi_a: ['1', '2', '3'],
        pi_b: [['4', '5'], ['6', '7'], ['8', '9']],
        pi_c: ['10', '11', '12'],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: ['client-1', 'client-2', 'client-3'],
    };
    mockedGroth16.fullProve.mockResolvedValue(fallbackProof);

    globalAny.window = {};
    globalAny.Worker = class MockWorker {
      constructor() {
        throw new Error('edge worker unavailable');
      }
    };

    const generator = new ProofGenerator(TEST_PATHS.wasm, TEST_PATHS.zkey, TEST_PATHS.vkey);
    const result = await generator.generateProof(TEST_WITNESS);

    expect(mockedGroth16.fullProve).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fallbackProof);
  });
});
