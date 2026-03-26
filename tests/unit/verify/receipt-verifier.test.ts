import { verifySharedReceiptProof } from '@/lib/verify/receipt-verifier';
import {
  deriveNullifierFromMessageHash,
  type NullifierStorageLike,
} from '@/lib/zk/nullifier';
import { deriveSelectiveClaimDigest } from '@/lib/zk/share';
import type { ShareableProofPayload } from '@/lib/zk/prover';

class InMemoryStorage implements NullifierStorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function buildProofPayload(
  publicSignals: string[],
  messageHash: string,
  nullifier: string
): ShareableProofPayload {
  return {
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
    publicSignals,
    oracleAuth: {
      expiresAt: 1700000300,
      messageHash,
      nullifier,
      nonce: 'c'.repeat(32),
      oracleSignature: 'a'.repeat(128),
      oraclePubKeyId: 'b'.repeat(16),
      signedAt: 1700000000,
    },
  };
}

describe('verifySharedReceiptProof', () => {
  const signatureVerifier = async () => ({ valid: true });

  it('verifies legacy proofs and reports disclosed claim states', async () => {
    const messageHash = 'oracle-legacy';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const payload = buildProofPayload(
      ['123450000', '1700000000', messageHash, 'unused'],
      messageHash,
      nullifier
    );

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result).toEqual({
      valid: true,
      claimedAmount: '123450000',
      claimedAmountDisclosure: 'disclosed',
      minDate: '2023-11-14',
      minDateDisclosure: 'disclosed',
      signalContract: 'legacy-v1',
    });
  });

  it('verifies selective proofs with hidden claims and returns hidden field markers', async () => {
    const messageHash = 'oracle-selective';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const claimDigest = await deriveSelectiveClaimDigest({
      claimedAmount: '123450000',
      disclosureMask: 0,
      minDateUnix: 1700000000,
    });
    const payload = buildProofPayload(
      [messageHash, '0', '0', '0', claimDigest],
      messageHash,
      nullifier
    );
    payload.proofPublicSignals = ['123450000', '1700000000', messageHash];

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result).toEqual({
      valid: true,
      claimedAmount: 'Hidden',
      claimedAmountDisclosure: 'hidden',
      minDate: 'Hidden',
      minDateDisclosure: 'hidden',
      signalContract: 'selective-disclosure-v1',
    });
  });

  it('verifies selective proofs when verification signals include a leading validity output', async () => {
    const messageHash = 'oracle-selective-prefixed';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const claimDigest = await deriveSelectiveClaimDigest({
      claimedAmount: '123450000',
      disclosureMask: 0,
      minDateUnix: 1700000000,
    });
    const payload = buildProofPayload(
      [messageHash, '0', '0', '0', claimDigest],
      messageHash,
      nullifier
    );
    payload.proofPublicSignals = ['1', '123450000', '1700000000', messageHash];

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result).toEqual({
      valid: true,
      claimedAmount: 'Hidden',
      claimedAmountDisclosure: 'hidden',
      minDate: 'Hidden',
      minDateDisclosure: 'hidden',
      signalContract: 'selective-disclosure-v1',
    });
  });

  it('includes validation-strength metadata when present in receipt meta payload', async () => {
    const messageHash = 'oracle-selective-meta';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const claimDigest = await deriveSelectiveClaimDigest({
      claimedAmount: '123450000',
      disclosureMask: 0,
      minDateUnix: 1700000000,
    });
    const payload = buildProofPayload(
      [messageHash, '0', '0', '0', claimDigest],
      messageHash,
      nullifier
    );
    payload.proofPublicSignals = ['123450000', '1700000000', messageHash];
    payload.receiptMeta = {
      oracleValidationStatus: 'single_source_fallback',
      oracleValidationLabel: 'Single-source fallback (primary); consensus source unavailable',
    };

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result).toEqual({
      valid: true,
      claimedAmount: 'Hidden',
      claimedAmountDisclosure: 'hidden',
      minDate: 'Hidden',
      minDateDisclosure: 'hidden',
      signalContract: 'selective-disclosure-v1',
      oracleValidationStatus: 'single_source_fallback',
      oracleValidationLabel: 'Single-source fallback (primary); consensus source unavailable',
    });
  });

  it('fails selective payloads when claim digest does not match proven claims', async () => {
    const messageHash = 'oracle-selective-digest';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const payload = buildProofPayload(
      [messageHash, '0', '0', '0', 'tampered-digest'],
      messageHash,
      nullifier
    );
    payload.proofPublicSignals = ['123450000', '1700000000', messageHash];

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid proof: claim digest mismatch detected');
  });

  it('falls back to verified legacy signals when selective envelope commitment mismatches', async () => {
    const messageHash = 'oracle-selective-fallback';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const payload = buildProofPayload(
      ['oracle-mismatch', '0', '0', '0', 'claim-digest-999'],
      messageHash,
      nullifier
    );
    payload.proofPublicSignals = ['123450000', '1700000000', messageHash];

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result).toEqual({
      valid: true,
      claimedAmount: '123450000',
      claimedAmountDisclosure: 'disclosed',
      minDate: '2023-11-14',
      minDateDisclosure: 'disclosed',
      signalContract: 'legacy-v1',
    });
  });

  it('fails when oracle commitment does not match supported signal slots', async () => {
    const messageHash = 'oracle-expected';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const payload = buildProofPayload(
      ['oracle-a', '3', '1000', '1700000000', 'claim-digest-999'],
      messageHash,
      nullifier
    );

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Oracle commitment mismatch detected');
  });

  it('fails selective payloads without legacy verification signals', async () => {
    const messageHash = 'oracle-selective-missing-v';
    const nullifier = await deriveNullifierFromMessageHash(messageHash);
    const claimDigest = await deriveSelectiveClaimDigest({
      claimedAmount: '123450000',
      disclosureMask: 0,
      minDateUnix: 1700000000,
    });
    const payload = buildProofPayload(
      [messageHash, '0', '0', '0', claimDigest],
      messageHash,
      nullifier
    );

    const result = await verifySharedReceiptProof('mock-proof', {
      createProofGenerator: () => ({
        importProof: () => payload,
        verifyProof: async () => ({ valid: true }),
      }),
      signatureVerifier,
      storage: new InMemoryStorage(),
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid proof: missing legacy verification signals for selective-disclosure payload');
  });
});
