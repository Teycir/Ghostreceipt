import { groth16 } from 'snarkjs';
import type { ReceiptWitness } from '@ghostreceipt/zk-core';
import {
  decodeSharePayload,
  encodeSharePayload,
  hasDangerousObjectKeys,
} from '@/lib/libraries/zk';

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
  nonce: string;
  oracleSignature: string;
  oraclePubKeyId: string;
  signedAt: number;
}

export interface ShareableProofPayload extends ProofResult {
  oracleAuth?: OracleAuthData;
}

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean;
  error?: string;
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
      // Load verification key
      const vkeyResponse = await fetch(this.vkeyPath);
      if (!vkeyResponse.ok) {
        throw new Error(`Failed to load verification key: ${vkeyResponse.statusText}`);
      }
      const vkey = await vkeyResponse.json();

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
  exportProof(result: ProofResult, oracleAuth?: OracleAuthData): string {
    const payload: ShareableProofPayload = {
      ...result,
      ...(oracleAuth ? { oracleAuth } : {}),
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
      const decoded = rawInput.startsWith('{') ? rawInput : decodeSharePayload(rawInput);
      
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
          typeof parsed.oracleAuth.nonce === 'string' &&
          typeof parsed.oracleAuth.oracleSignature === 'string' &&
          typeof parsed.oracleAuth.oraclePubKeyId === 'string' &&
          typeof parsed.oracleAuth.signedAt === 'number';
        if (!hasRequiredFields) {
          throw new Error('Invalid proof format');
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
  return new ProofGenerator(
    '/zk/receipt_js/receipt.wasm',
    '/zk/receipt_final.zkey',
    '/zk/verification_key.json'
  );
}
