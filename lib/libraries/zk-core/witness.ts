import type { OraclePayload } from '@/lib/validation/schemas';

/**
 * Witness input for receipt circuit
 */
export interface ReceiptWitness {
  // Public inputs
  claimedAmount: string;
  minDate: string;
  oracleCommitment: string;

  // Private inputs
  realValue: string;
  realTimestamp: string;
  txHash: string[];
  chainId: string;
}

/**
 * User claim for receipt generation
 */
export interface UserClaim {
  claimedAmount: string; // Amount in atomic units (satoshis/wei)
  minDate: number; // Unix timestamp
}

/**
 * Build witness input from oracle payload and user claim
 */
export function buildWitness(
  oraclePayload: OraclePayload,
  userClaim: UserClaim
): ReceiptWitness {
  if (oraclePayload.chain !== 'bitcoin' && oraclePayload.chain !== 'ethereum') {
    throw new Error(
      `Unsupported chain for current receipt circuit: ${oraclePayload.chain}. Supported: bitcoin, ethereum.`
    );
  }

  // Convert tx hash to array of 32-bit chunks
  const txHashChunks = hexToChunks(oraclePayload.txHash, 8);

  return {
    // Public inputs
    claimedAmount: userClaim.claimedAmount,
    minDate: userClaim.minDate.toString(),
    oracleCommitment: oraclePayload.messageHash,

    // Private inputs (from oracle)
    realValue: oraclePayload.valueAtomic,
    realTimestamp: oraclePayload.timestampUnix.toString(),
    txHash: txHashChunks,
    chainId: oraclePayload.chain === 'bitcoin' ? '0' : '1',
  };
}

/**
 * Convert hex string to array of 32-bit decimal chunks
 */
function hexToChunks(hex: string, numChunks: number): string[] {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Pad to required length
  const paddedHex = cleanHex.padStart(numChunks * 8, '0');

  // Split into chunks of 8 hex chars (32 bits)
  const chunks: string[] = [];
  for (let i = 0; i < numChunks; i++) {
    const chunk = paddedHex.slice(i * 8, (i + 1) * 8);
    const decimal = parseInt(chunk, 16).toString();
    chunks.push(decimal);
  }

  return chunks;
}

/**
 * Validate witness constraints before proof generation
 */
export function validateWitness(witness: ReceiptWitness): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check realValue >= claimedAmount
  const realValue = BigInt(witness.realValue);
  const claimedAmount = BigInt(witness.claimedAmount);

  if (realValue < claimedAmount) {
    errors.push(
      `Real value (${realValue}) is less than claimed amount (${claimedAmount})`
    );
  }

  // Check realTimestamp >= minDate
  const realTimestamp = BigInt(witness.realTimestamp);
  const minDate = BigInt(witness.minDate);

  if (realTimestamp < minDate) {
    errors.push(
      `Real timestamp (${realTimestamp}) is before minimum date (${minDate})`
    );
  }

  // Check signature is non-zero
  const oracleCommitment = BigInt(witness.oracleCommitment);
  if (oracleCommitment <= BigInt(0)) {
    errors.push('Oracle commitment must be positive');
  }

  // Check array lengths
  if (witness.txHash.length !== 8) {
    errors.push(`Transaction hash must have 8 chunks, got ${witness.txHash.length}`);
  }

  if (!['0', '1'].includes(witness.chainId)) {
    errors.push(`Chain ID must be 0 (bitcoin) or 1 (ethereum), got ${witness.chainId}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract public signals from witness (for verification)
 */
export function extractPublicSignals(witness: ReceiptWitness): string[] {
  return [
    witness.claimedAmount,
    witness.minDate,
    witness.oracleCommitment,
  ];
}
