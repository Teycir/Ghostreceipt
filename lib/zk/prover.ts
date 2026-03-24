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
}

export interface ShareableProofPayload extends ProofResult {
  oracleAuth?: OracleAuthData;
  receiptMeta?: ReceiptMetadata;
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
  private wasmPath: string;
  private zkeyPath: string;
  private vkeyPath: string;

  constructor(
    wasmPath: string,
    zkeyPath: string,
    vkeyPath: string
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
  }

  /**
   * Generate proof from witness
   */
  async generateProof(witness: ReceiptWitness): Promise<ProofResult> {
    try {
      if (canUseProofWorker()) {
        try {
          return await proveInWorker(witness, this.wasmPath, this.zkeyPath);
        } catch {
          // Fall through to main-thread proving when worker path is unavailable.
        }
      }

      const { proof, publicSignals } = await groth16.fullProve(
        witness as any,
        this.wasmPath,
        this.zkeyPath
      );

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
  exportProof(
    result: ProofResult,
    oracleAuth?: OracleAuthData,
    receiptMeta?: ReceiptMetadata
  ): string {
    const payload: ShareableProofPayload = {
      ...result,
      ...(oracleAuth ? { oracleAuth } : {}),
      ...(receiptMeta ? { receiptMeta } : {}),
    };
    return encodeSharePayload(JSON.stringify(payload));
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

      // Validate structure
      if (!parsed.proof || !Array.isArray(parsed.publicSignals)) {
        throw new Error('Invalid proof format');
      }

      if (parsed.oracleAuth) {
        const hasRequiredFields =
          typeof parsed.oracleAuth.expiresAt === 'number' &&
          typeof parsed.oracleAuth.messageHash === 'string' &&
          typeof parsed.oracleAuth.nullifier === 'string' &&
          typeof parsed.oracleAuth.nonce === 'string' &&
          typeof parsed.oracleAuth.oracleSignature === 'string' &&
          typeof parsed.oracleAuth.oraclePubKeyId === 'string' &&
          typeof parsed.oracleAuth.signedAt === 'number';
        if (!hasRequiredFields) {
          throw new Error('Invalid proof format');
        }
      }

      if (parsed.receiptMeta !== undefined) {
        const meta = parsed.receiptMeta;
        const validObject = typeof meta === 'object' && meta !== null && !Array.isArray(meta);
        if (!validObject) {
          throw new Error('Invalid proof format');
        }

        if (meta.label !== undefined) {
          const validLabel =
            typeof meta.label === 'string' &&
            meta.label.trim().length > 0 &&
            meta.label.length <= 80;
          if (!validLabel) {
            throw new Error('Invalid proof format');
          }
        }

        if (meta.category !== undefined) {
          const validCategory =
            typeof meta.category === 'string' &&
            meta.category.trim().length > 0 &&
            meta.category.length <= 40;
          if (!validCategory) {
            throw new Error('Invalid proof format');
          }
        }
      }

      return parsed as ShareableProofPayload;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to import proof: ${error.message}`, {
          cause: error,
        });
      }
      throw new Error('Failed to import proof: Unknown error');
    }
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
    artifactPaths.vkeyPath
  );
}
