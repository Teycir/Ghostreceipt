import { groth16 } from 'snarkjs';
import { ProofGenerator } from '@/lib/zk/prover';
import { __resetZkArtifactCachesForTests } from '@/lib/zk/artifacts';

jest.mock('snarkjs', () => ({
  groth16: {
    fullProve: jest.fn(),
    verify: jest.fn(),
  },
}));

describe('ProofGenerator runtime behavior', () => {
  const mockedGroth16 = groth16 as unknown as {
    fullProve: jest.Mock;
    verify: jest.Mock;
  };

  beforeEach(() => {
    __resetZkArtifactCachesForTests();
    jest.clearAllMocks();
  });

  it('falls back to direct fullProve when worker path is unavailable', async () => {
    mockedGroth16.fullProve.mockResolvedValue({
      proof: {
        pi_a: ['1', '2', '3'],
        pi_b: [['4', '5'], ['6', '7']],
        pi_c: ['8', '9', '10'],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: ['11', '12', '13'],
    });

    const generator = new ProofGenerator(
      '/zk/receipt_js/receipt.wasm?v=test',
      '/zk/receipt_final.zkey?v=test',
      '/zk/verification_key.json?v=test'
    );
    const result = await generator.generateProof({
      chainId: '0',
      claimedAmount: '1',
      minDate: '1',
      oracleCommitment: '1',
      realTimestamp: '1',
      realValue: '1',
      txHash: Array.from({ length: 8 }, () => '1'),
    });

    expect(mockedGroth16.fullProve).toHaveBeenCalledTimes(1);
    expect(result.publicSignals).toEqual(['11', '12', '13']);
  });

  it('reuses cached verification key across verifyProof calls', async () => {
    mockedGroth16.verify.mockResolvedValue(true);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ vk_alpha_1: ['1', '2'] }), { status: 200 })
    );

    const generator = new ProofGenerator(
      '/zk/receipt_js/receipt.wasm?v=test',
      '/zk/receipt_final.zkey?v=test',
      '/zk/verification_key.json?v=test'
    );
    const proof = {
      pi_a: ['1', '2', '3'],
      pi_b: [['4', '5'], ['6', '7']],
      pi_c: ['8', '9', '10'],
      protocol: 'groth16',
      curve: 'bn128',
    };

    const resultA = await generator.verifyProof(['1'], proof);
    const resultB = await generator.verifyProof(['1'], proof);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resultA.valid).toBe(true);
    expect(resultB.valid).toBe(true);
  });
});
