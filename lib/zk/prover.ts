import { groth16 } from 'snarkjs';
import type { ReceiptWitness } from '@ghostreceipt/zk-core';
import {
  decodeSharePayload,
  encodeSharePayload,
  hasDangerousObjectKeys,
} from '@/lib/libraries/zk';
import {
  fetchVerificationKeyCached,
  getDefaultZkArtifactPaths,
} from '@/lib/zk/artifacts';
import { buildSelectiveDisclosurePublicSignals } from '@/lib/zk/share';

/**
 * Proof generation result
 */
export interface ProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

export interface ProofRuntimeInfo {
  artifactVersion: string;
  backend: 'groth16';
  executionMode: 'worker' | 'main-thread';
}

export interface OracleAuthData {
  expiresAt: number;
  messageHash: string;
  nullifier: string;
  nonce: string;
  oracleSignature: string;
  oraclePubKeyId: string;
  signedAt: number;
}

export interface ReceiptMetadata {
  category?: string;
  label?: string;
  oracleValidationLabel?: string;
  oracleValidationStatus?: 'consensus_verified' | 'single_source_fallback' | 'single_source_only';
}

export interface ShareableProofPayload extends ProofResult {
  proofPublicSignals?: string[];
  oracleAuth?: OracleAuthData;
  receiptMeta?: ReceiptMetadata;
}

interface CompactProofPayload {
  m?: CompactReceiptMeta;
  o?: CompactOracleAuth;
  p: CompactProof;
  s: string[];
  v?: string[];
}

interface CompactProof {
  a: string[];
  b: string[][];
  c: string[];
}

interface CompactOracleAuth {
  e: number;
  h: string;
  k: string;
  n: string;
  r: string;
  sg: string;
  t: number;
}

interface CompactReceiptMeta {
  c?: string;
  l?: string;
  vl?: string;
  vs?: string;
}

export interface SelectiveDisclosurePackagingOptions {
  claimedAmount: string;
  discloseAmount: boolean;
  discloseMinDate: boolean;
  minDateUnix: number;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function assertValidReceiptMeta(meta: unknown): ReceiptMetadata {
  if (!isObjectRecord(meta)) {
    throw new Error('Invalid proof format');
  }

  const label = meta['l'];
  const category = meta['c'];
  const oracleValidationStatus = meta['vs'];
  const oracleValidationLabel = meta['vl'];

  if (label !== undefined) {
    const validLabel =
      typeof label === 'string' &&
      label.trim().length > 0 &&
      label.length <= 80;
    if (!validLabel) {
      throw new Error('Invalid proof format');
    }
  }

  if (category !== undefined) {
    const validCategory =
      typeof category === 'string' &&
      category.trim().length > 0 &&
      category.length <= 40;
    if (!validCategory) {
      throw new Error('Invalid proof format');
    }
  }

  if (oracleValidationStatus !== undefined) {
    const validStatus =
      oracleValidationStatus === 'consensus_verified' ||
      oracleValidationStatus === 'single_source_fallback' ||
      oracleValidationStatus === 'single_source_only';
    if (!validStatus) {
      throw new Error('Invalid proof format');
    }
  }

  if (oracleValidationLabel !== undefined) {
    const validValidationLabel =
      typeof oracleValidationLabel === 'string' &&
      oracleValidationLabel.trim().length > 0 &&
      oracleValidationLabel.length <= 200;
    if (!validValidationLabel) {
      throw new Error('Invalid proof format');
    }
  }

  return {
    ...(typeof label === 'string' ? { label } : {}),
    ...(typeof category === 'string' ? { category } : {}),
    ...(oracleValidationStatus === 'consensus_verified' ||
    oracleValidationStatus === 'single_source_fallback' ||
    oracleValidationStatus === 'single_source_only'
      ? { oracleValidationStatus }
      : {}),
    ...(typeof oracleValidationLabel === 'string' ? { oracleValidationLabel } : {}),
  };
}

function assertValidOracleAuth(value: unknown): OracleAuthData {
  if (!isObjectRecord(value)) {
    throw new Error('Invalid proof format');
  }

  const expiresAt = value['e'];
  const messageHash = value['h'];
  const nullifier = value['n'];
  const nonce = value['r'];
  const oracleSignature = value['sg'];
  const oraclePubKeyId = value['k'];
  const signedAt = value['t'];

  const hasRequiredFields =
    typeof expiresAt === 'number' &&
    typeof messageHash === 'string' &&
    typeof nullifier === 'string' &&
    typeof nonce === 'string' &&
    typeof oracleSignature === 'string' &&
    typeof oraclePubKeyId === 'string' &&
    typeof signedAt === 'number';

  if (!hasRequiredFields) {
    throw new Error('Invalid proof format');
  }

  return {
    expiresAt,
    messageHash,
    nullifier,
    nonce,
    oracleSignature,
    oraclePubKeyId,
    signedAt,
  };
}

function toCompactPayload(
  payload: ShareableProofPayload
): CompactProofPayload {
  return {
    p: {
      a: payload.proof.pi_a,
      b: payload.proof.pi_b,
      c: payload.proof.pi_c,
    },
    s: payload.publicSignals,
    ...(payload.proofPublicSignals ? { v: payload.proofPublicSignals } : {}),
    ...(payload.oracleAuth
      ? {
          o: {
            e: payload.oracleAuth.expiresAt,
            h: payload.oracleAuth.messageHash,
            n: payload.oracleAuth.nullifier,
            r: payload.oracleAuth.nonce,
            sg: payload.oracleAuth.oracleSignature,
            k: payload.oracleAuth.oraclePubKeyId,
            t: payload.oracleAuth.signedAt,
          },
        }
      : {}),
    ...(payload.receiptMeta
      ? {
          m: {
            ...(payload.receiptMeta.label ? { l: payload.receiptMeta.label } : {}),
            ...(payload.receiptMeta.category ? { c: payload.receiptMeta.category } : {}),
            ...(payload.receiptMeta.oracleValidationStatus
              ? { vs: payload.receiptMeta.oracleValidationStatus }
              : {}),
            ...(payload.receiptMeta.oracleValidationLabel
              ? { vl: payload.receiptMeta.oracleValidationLabel }
              : {}),
          },
        }
      : {}),
  };
}

function fromCompactPayload(raw: unknown): ShareableProofPayload {
  if (!isObjectRecord(raw)) {
    throw new Error('Invalid proof format');
  }

  const compactProof = raw['p'];
  const publicSignals = raw['s'];
  if (!isObjectRecord(compactProof) || !isStringArray(publicSignals)) {
    throw new Error('Invalid proof format');
  }
  const proofPublicSignalsRaw = raw['v'];
  if (proofPublicSignalsRaw !== undefined && !isStringArray(proofPublicSignalsRaw)) {
    throw new Error('Invalid proof format');
  }

  const piA = compactProof['a'];
  const piB = compactProof['b'];
  const piC = compactProof['c'];

  const validPiB =
    Array.isArray(piB) &&
    piB.length === 3 &&
    piB.every((row) => isStringArray(row) && row.length === 2);
  if (!isStringArray(piA) || piA.length !== 3 || !validPiB || !isStringArray(piC) || piC.length !== 3) {
    throw new Error('Invalid proof format');
  }

  const compactOracleAuth = raw['o'];
  const compactMeta = raw['m'];

  return {
    proof: {
      pi_a: piA,
      pi_b: piB,
      pi_c: piC,
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals,
    ...(proofPublicSignalsRaw !== undefined ? { proofPublicSignals: proofPublicSignalsRaw } : {}),
    ...(compactOracleAuth !== undefined ? { oracleAuth: assertValidOracleAuth(compactOracleAuth) } : {}),
    ...(compactMeta !== undefined ? { receiptMeta: assertValidReceiptMeta(compactMeta) } : {}),
  };
}

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean;
  error?: string;
}

interface WorkerProveRequestMessage {
  id: number;
  type: 'prove';
  witness: ReceiptWitness;
  wasmPath: string;
  zkeyPath: string;
}

interface WorkerProveSuccessMessage {
  id: number;
  proof: ProofResult['proof'];
  publicSignals: string[];
  type: 'prove_success';
}

interface WorkerProveErrorMessage {
  error: string;
  id: number;
  type: 'prove_error';
}

type WorkerProveResponseMessage = WorkerProveSuccessMessage | WorkerProveErrorMessage;

let nextWorkerRequestId = 0;

function canUseProofWorker(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

async function proveInWorker(
  witness: ReceiptWitness,
  wasmPath: string,
  zkeyPath: string
): Promise<ProofResult> {
  const { createProofWorker } = await import('./proof-worker-client');
  const worker = createProofWorker();
  const requestId = ++nextWorkerRequestId;

  return await new Promise<ProofResult>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (): void => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<WorkerProveResponseMessage>): void => {
      const message = event.data;
      if (!message || message.id !== requestId) {
        return;
      }

      cleanup();
      if (message.type === 'prove_error') {
        reject(new Error(message.error));
        return;
      }

      resolve({
        proof: message.proof,
        publicSignals: message.publicSignals,
      });
    };

    worker.onerror = (event: ErrorEvent): void => {
      cleanup();
      reject(new Error(event.message || 'Proof worker failed'));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Proof worker timed out'));
    }, 180_000);

    const request: WorkerProveRequestMessage = {
      id: requestId,
      type: 'prove',
      witness,
      wasmPath,
      zkeyPath,
    };
    worker.postMessage(request);
  });
}

/**
 * Proof generator for receipt circuit
 */
export class ProofGenerator {
  private readonly artifactVersion: string;
  private lastExecutionMode: ProofRuntimeInfo['executionMode'];
  private wasmPath: string;
  private zkeyPath: string;
  private vkeyPath: string;

  constructor(
    wasmPath: string,
    zkeyPath: string,
    vkeyPath: string,
    artifactVersion = 'unknown'
  ) {
    // Validate paths are within expected /zk/ directory (defense-in-depth)
    if (!wasmPath.startsWith('/zk/') || wasmPath.includes('..')) {
      throw new Error('Invalid WASM path: must be within /zk/ directory');
    }
    if (!zkeyPath.startsWith('/zk/') || zkeyPath.includes('..')) {
      throw new Error('Invalid zkey path: must be within /zk/ directory');
    }
    if (!vkeyPath.startsWith('/zk/') || vkeyPath.includes('..')) {
      throw new Error('Invalid verification key path: must be within /zk/ directory');
    }

    this.wasmPath = wasmPath;
    this.zkeyPath = zkeyPath;
    this.vkeyPath = vkeyPath;
    this.artifactVersion = artifactVersion;
    this.lastExecutionMode = 'main-thread';
  }

  /**
   * Generate proof from witness
   */
  async generateProof(witness: ReceiptWitness): Promise<ProofResult> {
    try {
      if (canUseProofWorker()) {
        try {
          const workerResult = await proveInWorker(witness, this.wasmPath, this.zkeyPath);
          this.lastExecutionMode = 'worker';
          return workerResult;
        } catch (error) {
          // Fall through to main-thread proving when worker path is unavailable.
          if (error instanceof Error) {
            console.warn('[ProofGenerator] Worker proof failed, falling back to main thread:', error.message);
          }
        }
      }

      const { proof, publicSignals } = await groth16.fullProve(
        witness as any,
        this.wasmPath,
        this.zkeyPath
      );
      this.lastExecutionMode = 'main-thread';

      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Proof generation failed: ${error.message}`, {
          cause: error,
        });
      }
      throw new Error('Proof generation failed: Unknown error');
    }
  }

  /**
   * Verify proof
   */
  async verifyProof(
    publicSignals: string[],
    proof: ProofResult['proof']
  ): Promise<VerificationResult> {
    try {
      const vkey = await fetchVerificationKeyCached(this.vkeyPath);

      // Verify proof
      const valid = await groth16.verify(vkey, publicSignals, proof);

      return { valid };
    } catch (error) {
      if (error instanceof Error) {
        return {
          valid: false,
          error: error.message,
        };
      }
      return {
        valid: false,
        error: 'Unknown verification error',
      };
    }
  }

  /**
   * Export proof to shareable format
   */
  async exportProof(
    result: ProofResult,
    oracleAuth?: OracleAuthData,
    receiptMeta?: ReceiptMetadata,
    selectiveDisclosure?: SelectiveDisclosurePackagingOptions
  ): Promise<string> {
    const selectivePublicSignals = selectiveDisclosure
      ? await buildSelectiveDisclosurePublicSignals({
          oracleCommitment: oracleAuth?.messageHash ?? '',
          claimedAmount: selectiveDisclosure.claimedAmount,
          disclosureMask:
            (selectiveDisclosure.discloseAmount ? 1 : 0) +
            (selectiveDisclosure.discloseMinDate ? 2 : 0),
          minDateUnix: selectiveDisclosure.minDateUnix,
        })
      : null;

    const payload: ShareableProofPayload = {
      ...result,
      publicSignals: selectivePublicSignals ?? result.publicSignals,
      ...(selectivePublicSignals ? { proofPublicSignals: result.publicSignals } : {}),
      ...(oracleAuth ? { oracleAuth } : {}),
      ...(receiptMeta ? { receiptMeta } : {}),
    };
    return encodeSharePayload(JSON.stringify(toCompactPayload(payload)));
  }

  /**
   * Import proof from shareable format
   */
  importProof(exported: string): ShareableProofPayload {
    const rawInput = exported.trim();

    // Size limit for imported proofs (100KB)
    if (rawInput.length > 1024 * 100) {
      throw new Error('Proof payload too large');
    }

    try {
      const decoded = decodeSharePayload(rawInput);
      
      // Additional size check after decoding
      if (decoded.length > 1024 * 100) {
        throw new Error('Decoded proof payload too large');
      }

      const parsed = JSON.parse(decoded);

      // Prevent prototype pollution
      if (hasDangerousObjectKeys(parsed)) {
        throw new Error('Invalid proof format: potentially malicious structure');
      }

      return fromCompactPayload(parsed);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to import proof: ${error.message}`, {
          cause: error,
        });
      }
      throw new Error('Failed to import proof: Unknown error');
    }
  }

  getRuntimeInfo(): ProofRuntimeInfo {
    return {
      artifactVersion: this.artifactVersion,
      backend: 'groth16',
      executionMode: this.lastExecutionMode,
    };
  }
}

/**
 * Create proof generator with default paths
 */
export function createProofGenerator(): ProofGenerator {
  const artifactPaths = getDefaultZkArtifactPaths();
  return new ProofGenerator(
    artifactPaths.wasmPath,
    artifactPaths.zkeyPath,
    artifactPaths.vkeyPath,
    artifactPaths.version
  );
}
