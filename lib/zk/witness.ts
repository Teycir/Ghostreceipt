import type { OraclePayloadV1 } from '@/lib/validation/schemas';

/**
 * Witness input for receipt circuit
 */
export interface ReceiptWitness {
  // Public inputs
  claimedAmount: string;
  minDate: string;
  oracleSignature: string[];
  
  // Private inputs
  realValue: string;
  realTimestamp: string;
  txHash: string[];
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
  oraclePayload: OraclePayloadV1,
  userClaim: UserClaim
): ReceiptWitness {
  // Convert oracle signature to array of 32-bit chunks
  const signatureChunks = hexToChunks(oraclePayload.oracleSignature, 8);
  
  // Convert tx hash to array of 32-bit chunks
  const txHashChunks = hexToChunks(oraclePayload.txHash, 8);
  
  return {
    // Public inputs
    claimedAmount: userClaim.claimedAmount,
    minDate: userClaim.minDate.toString(),
    oracleSignature: signatureChunks,
    
    // Private inputs (from oracle)
    realValue: oraclePayload.valueAtomic,
    realTimestamp: oraclePayload.timestampUnix.toString(),
    txHash: txHashChunks,
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
  const signatureSum = witness.oracleSignature.reduce(
    (sum, chunk) => sum + BigInt(chunk),
    BigInt(0)
  );
  
  if (signatureSum === BigInt(0)) {
    errors.push('Oracle signature is zero');
  }
  
  // Check array lengths
  if (witness.oracleSignature.length !== 8) {
    errors.push(
      `Oracle signature must have 8 chunks, got ${witness.oracleSignature.length}`
    );
  }
  
  if (witness.txHash.length !== 8) {
    errors.push(`Transaction hash must have 8 chunks, got ${witness.txHash.length}`);
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
    ...witness.oracleSignature,
  ];
}
