import { groth16 } from 'snarkjs';
import type { ReceiptWitness } from './witness';

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
  exportProof(result: ProofResult): string {
    return encodeSharePayload(JSON.stringify(result));
  }

  /**
   * Import proof from shareable format
   */
  importProof(exported: string): ProofResult {
    const rawInput = exported.trim();

    try {
      const parsed = JSON.parse(
        rawInput.startsWith('{') ? rawInput : decodeSharePayload(rawInput)
      );

      // Validate structure
      if (!parsed.proof || !Array.isArray(parsed.publicSignals)) {
        throw new Error('Invalid proof format');
      }

      return parsed as ProofResult;
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
    '/zk/receipt.wasm',
    '/zk/receipt_final.zkey',
    '/zk/verification_key.json'
  );
}

function encodeSharePayload(jsonPayload: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(jsonPayload, 'utf8').toString('base64url');
  }

  const bytes = new TextEncoder().encode(jsonPayload);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeSharePayload(encodedPayload: string): string {
  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = `${base64}${padding}`;

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64').toString('utf8');
  }

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
