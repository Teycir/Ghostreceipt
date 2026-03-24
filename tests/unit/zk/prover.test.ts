import { ProofGenerator, type ProofResult } from '@/lib/zk/prover';
import { decodeSharePayload, encodeSharePayload } from '@/lib/libraries/zk';
import { deriveSelectiveClaimDigest } from '@/lib/zk/share';

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

  it('exports a URL-safe encoded payload and round-trips correctly', async () => {
    const exported = await generator.exportProof(sampleProof);

    expect(exported).toMatch(/^[A-Za-z0-9\-_]+$/);

    const imported = generator.importProof(exported);
    expect(imported).toEqual(sampleProof);
  });

  it('uses a compact canonical encoded payload compared to legacy shape', async () => {
    const compactExported = await generator.exportProof(sampleProof);
    const legacyExported = encodeSharePayload(JSON.stringify(sampleProof));

    expect(compactExported.length).toBeLessThan(legacyExported.length);
  });

  it('exports deterministic payloads for identical inputs', async () => {
    const oracleAuth = {
      expiresAt: 1700000300,
      messageHash: '123456789',
      nullifier: 'd'.repeat(64),
      nonce: 'c'.repeat(32),
      oracleSignature: 'a'.repeat(128),
      oraclePubKeyId: 'b'.repeat(16),
      signedAt: 1700000000,
    };
    const receiptMeta = {
      label: 'Invoice #428',
      category: 'Operations',
    };

    const first = await generator.exportProof(sampleProof, oracleAuth, receiptMeta);
    const second = await generator.exportProof(
      JSON.parse(JSON.stringify(sampleProof)) as ProofResult,
      { ...oracleAuth },
      { ...receiptMeta }
    );
    const roundTrip = await generator.exportProof(generator.importProof(first));

    expect(second).toBe(first);
    expect(roundTrip).toBe(first);
  });

  it('rejects plain JSON payloads and requires encoded share format', () => {
    const plainJsonPayload = JSON.stringify(sampleProof);

    expect(() => generator.importProof(plainJsonPayload)).toThrow(
      'Failed to import proof'
    );
  });

  it('round-trips oracle authentication metadata in share payloads', async () => {
    const exported = await generator.exportProof(sampleProof, {
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

  it('round-trips optional receipt metadata in share payloads', async () => {
    const exported = await generator.exportProof(
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

  it('exports selective share signals in canonical order and preserves proof verification signals', async () => {
    const oracleAuth = {
      expiresAt: 1700000300,
      messageHash: '123456789',
      nullifier: 'd'.repeat(64),
      nonce: 'c'.repeat(32),
      oracleSignature: 'a'.repeat(128),
      oraclePubKeyId: 'b'.repeat(16),
      signedAt: 1700000000,
    };

    const exported = await generator.exportProof(
      sampleProof,
      oracleAuth,
      undefined,
      {
        claimedAmount: '1000',
        discloseAmount: false,
        discloseMinDate: true,
        minDateUnix: 1700000000,
      }
    );

    const decodedRaw = JSON.parse(decodeSharePayload(exported)) as {
      p: unknown;
      s: string[];
      v: string[];
    };
    const imported = generator.importProof(exported);
    const expectedClaimDigest = await deriveSelectiveClaimDigest({
      claimedAmount: '1000',
      disclosureMask: 2,
      minDateUnix: 1700000000,
    });

    expect(decodedRaw.s).toEqual([
      oracleAuth.messageHash,
      '2',
      '0',
      '1700000000',
      expectedClaimDigest,
    ]);
    expect(decodedRaw.v).toEqual(sampleProof.publicSignals);
    expect(imported.publicSignals).toEqual(decodedRaw.s);
    expect(imported.proofPublicSignals).toEqual(sampleProof.publicSignals);
  });
});
