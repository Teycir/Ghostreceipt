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

  it('uses a compact canonical encoded payload compared to legacy shape', () => {
    const compactExported = generator.exportProof(sampleProof);
    const legacyExported = encodeSharePayload(JSON.stringify(sampleProof));

    expect(compactExported.length).toBeLessThan(legacyExported.length);
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

  it('round-trips optional receipt metadata in share payloads', () => {
    const exported = generator.exportProof(
      sampleProof,
      {
        expiresAt: 1700000300,
        messageHash: '123456789',
        nullifier: 'd'.repeat(64),
        nonce: 'c'.repeat(32),
        oracleSignature: 'a'.repeat(128),
        oraclePubKeyId: 'b'.repeat(16),
        signedAt: 1700000000,
      },
      {
        label: 'Invoice #428',
        category: 'Operations',
      }
    );

    const imported = generator.importProof(exported);

    expect(imported.receiptMeta).toEqual({
      label: 'Invoice #428',
      category: 'Operations',
    });
  });

  it('rejects malformed payloads', () => {
    expect(() => generator.importProof('not-a-valid-proof')).toThrow(
      'Failed to import proof'
    );
  });

  it('rejects malformed oracleAuth blocks in imported payloads', () => {
    const malformedOracleAuthPayload = encodeSharePayload(JSON.stringify({
      p: {
        a: sampleProof.proof.pi_a,
        b: sampleProof.proof.pi_b,
        c: sampleProof.proof.pi_c,
      },
      s: sampleProof.publicSignals,
      o: {
        e: 1700000300,
        h: '123456789',
        n: 'd'.repeat(64),
        r: 'c'.repeat(32),
        k: 'b'.repeat(16),
        t: 1700000000,
      },
    }));

    expect(() => generator.importProof(malformedOracleAuthPayload)).toThrow(
      'Invalid proof format'
    );
  });

  it('rejects payloads containing prototype-pollution keys', () => {
    const maliciousPayload = encodeSharePayload(
      '{"p":{"a":["1","2","3"],"b":[["4","5"],["6","7"],["8","9"]],"c":["10","11","12"]},"s":["1","2","3"],"o":{"h":"123","sg":"' +
      'a'.repeat(128) +
      '","k":"k1","e":1700000300,"n":"x","r":"y","t":1700000000,"__proto__":{"polluted":true}}}'
    );

    expect(() => generator.importProof(maliciousPayload)).toThrow(
      'Invalid proof format: potentially malicious structure'
    );
  });

  it('rejects malformed receipt metadata in imported payloads', () => {
    const malformedMetaPayload = encodeSharePayload(JSON.stringify({
      p: {
        a: sampleProof.proof.pi_a,
        b: sampleProof.proof.pi_b,
        c: sampleProof.proof.pi_c,
      },
      s: sampleProof.publicSignals,
      m: {
        l: '',
        c: 'Operations',
      },
    }));

    expect(() => generator.importProof(malformedMetaPayload)).toThrow(
      'Invalid proof format'
    );
  });

  it('rejects legacy encoded payload shape after hard cutover', () => {
    const legacyPayload = encodeSharePayload(
      JSON.stringify({
        ...sampleProof,
        oracleAuth: {
          expiresAt: 1700000300,
          messageHash: '123456789',
          nullifier: 'd'.repeat(64),
          nonce: 'c'.repeat(32),
          oracleSignature: 'a'.repeat(128),
          oraclePubKeyId: 'b'.repeat(16),
          signedAt: 1700000000,
        },
      })
    );

    expect(() => generator.importProof(legacyPayload)).toThrow('Invalid proof format');
  });
});
