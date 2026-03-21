import { ProofGenerator, type ProofResult } from '@/lib/zk/prover';

describe('ProofGenerator share payload encoding', () => {
  const generator = new ProofGenerator('/zk/receipt.wasm', '/zk/receipt_final.zkey', '/zk/verification_key.json');

  const sampleProof: ProofResult = {
    proof: {
      pi_a: ['1', '2', '3'],
      pi_b: [
        ['4', '5'],
        ['6', '7'],
        ['8', '9'],
      ],
      pi_c: ['10', '11', '12'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: ['1000', '1700000000', '1', '2', '3', '4', '5', '6', '7', '8'],
  };

  it('exports a URL-safe encoded payload and round-trips correctly', () => {
    const exported = generator.exportProof(sampleProof);

    expect(exported).toMatch(/^[A-Za-z0-9\-_]+$/);

    const imported = generator.importProof(exported);
    expect(imported).toEqual(sampleProof);
  });

  it('supports legacy plain JSON payload format for backward compatibility', () => {
    const legacyPayload = JSON.stringify(sampleProof);

    const imported = generator.importProof(legacyPayload);

    expect(imported).toEqual(sampleProof);
  });

  it('rejects malformed payloads', () => {
    expect(() => generator.importProof('not-a-valid-proof')).toThrow(
      'Failed to import proof'
    );
  });
});
