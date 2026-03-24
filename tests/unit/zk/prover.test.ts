import { ProofGenerator, type ProofResult } from '@/lib/zk/prover';
import { encodeSharePayload } from '@/lib/libraries/zk';

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

  it('rejects plain JSON payloads and requires encoded share format', () => {
    const plainJsonPayload = JSON.stringify(sampleProof);

    expect(() => generator.importProof(plainJsonPayload)).toThrow(
      'Failed to import proof'
    );
  });

  it('round-trips oracle authentication metadata in share payloads', () => {
    const exported = generator.exportProof(sampleProof, {
      expiresAt: 1700000300,
      messageHash: '123456789',
      nullifier: 'd'.repeat(64),
      nonce: 'c'.repeat(32),
      oracleSignature: 'a'.repeat(128),
      oraclePubKeyId: 'b'.repeat(16),
      signedAt: 1700000000,
    });

    const imported = generator.importProof(exported);

    expect(imported.oracleAuth).toEqual({
      expiresAt: 1700000300,
      messageHash: '123456789',
      nullifier: 'd'.repeat(64),
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

  it('rejects malformed oracleAuth blocks in imported payloads', () => {
    const malformedOracleAuthPayload = encodeSharePayload(JSON.stringify({
      ...sampleProof,
      oracleAuth: {
        expiresAt: 1700000300,
        messageHash: '123456789',
        nullifier: 'd'.repeat(64),
        nonce: 'c'.repeat(32),
        oraclePubKeyId: 'b'.repeat(16),
        signedAt: 1700000000,
      },
    }));

    expect(() => generator.importProof(malformedOracleAuthPayload)).toThrow(
      'Invalid proof format'
    );
  });

  it('rejects payloads containing prototype-pollution keys', () => {
    const maliciousPayload = encodeSharePayload(
      '{"proof":{"pi_a":["1","2","3"],"pi_b":[["4","5"],["6","7"],["8","9"]],"pi_c":["10","11","12"],"protocol":"groth16","curve":"bn128"},"publicSignals":["1","2","3"],"oracleAuth":{"messageHash":"123","oracleSignature":"' +
      'a'.repeat(128) +
      '","oraclePubKeyId":"k1","signedAt":1700000000,"__proto__":{"polluted":true}}}'
    );

    expect(() => generator.importProof(maliciousPayload)).toThrow(
      'Invalid proof format: potentially malicious structure'
    );
  });
});
