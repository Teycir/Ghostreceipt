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

  it('round-trips oracle authentication metadata in share payloads', () => {
    const exported = generator.exportProof(sampleProof, {
      expiresAt: 1700000300,
      messageHash: '123456789',
      nonce: 'c'.repeat(32),
      oracleSignature: 'a'.repeat(128),
      oraclePubKeyId: 'b'.repeat(16),
      signedAt: 1700000000,
    });

    const imported = generator.importProof(exported);

    expect(imported.oracleAuth).toEqual({
      expiresAt: 1700000300,
      messageHash: '123456789',
      nonce: 'c'.repeat(32),
      oracleSignature: 'a'.repeat(128),
      oraclePubKeyId: 'b'.repeat(16),
      signedAt: 1700000000,
    });
  });

  it('rejects malformed payloads', () => {
    expect(() => generator.importProof('not-a-valid-proof')).toThrow(
      'Failed to import proof'
    );
  });

  it('rejects payloads containing prototype-pollution keys', () => {
    const maliciousPayload =
      '{"proof":{"pi_a":["1","2","3"],"pi_b":[["4","5"],["6","7"],["8","9"]],"pi_c":["10","11","12"],"protocol":"groth16","curve":"bn128"},"publicSignals":["1","2","3"],"oracleAuth":{"messageHash":"123","oracleSignature":"' +
      'a'.repeat(128) +
      '","oraclePubKeyId":"k1","signedAt":1700000000,"__proto__":{"polluted":true}}}';

    expect(() => generator.importProof(maliciousPayload)).toThrow(
      'Invalid proof format: potentially malicious structure'
    );
  });
});
