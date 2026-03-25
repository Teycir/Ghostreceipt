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

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX_MAP = new Map<string, number>(
  BASE58_ALPHABET.split('').map((character, index) => [character, index])
);

const SHA256_INITIAL_HASH = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
] as const;

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

/**
 * Build witness input from oracle payload and user claim
 */
export function buildWitness(
  oraclePayload: OraclePayload,
  userClaim: UserClaim
): ReceiptWitness {
  if (
    oraclePayload.chain !== 'bitcoin'
    && oraclePayload.chain !== 'ethereum'
    && oraclePayload.chain !== 'solana'
  ) {
    throw new Error(
      `Unsupported chain for current receipt circuit: ${oraclePayload.chain}. Supported: bitcoin, ethereum, solana.`
    );
  }

  // Convert tx hash to array of 32-bit chunks
  const txHashChunks = txHashToChunks(oraclePayload.chain, oraclePayload.txHash, 8);

  return {
    // Public inputs
    claimedAmount: userClaim.claimedAmount,
    minDate: userClaim.minDate.toString(),
    oracleCommitment: oraclePayload.messageHash,

    // Private inputs (from oracle)
    realValue: oraclePayload.valueAtomic,
    realTimestamp: oraclePayload.timestampUnix.toString(),
    txHash: txHashChunks,
    chainId:
      oraclePayload.chain === 'bitcoin'
        ? '0'
        : oraclePayload.chain === 'ethereum'
          ? '1'
          : '2',
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

function bytesToChunks(bytes: Uint8Array, numChunks: number): string[] {
  const targetLength = numChunks * 4;
  const normalized = bytes.length >= targetLength
    ? bytes.slice(0, targetLength)
    : Uint8Array.from([...bytes, ...new Uint8Array(targetLength - bytes.length)]);

  const chunks: string[] = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * 4;
    const chunkValue =
      (normalized[start]! << 24)
      | (normalized[start + 1]! << 16)
      | (normalized[start + 2]! << 8)
      | normalized[start + 3]!;
    chunks.push((chunkValue >>> 0).toString());
  }

  return chunks;
}

function decodeBase58(value: string): Uint8Array {
  if (!value) {
    throw new Error('Solana transaction signature cannot be empty');
  }

  let decoded = BigInt(0);
  for (const character of value) {
    const digit = BASE58_INDEX_MAP.get(character);
    if (digit === undefined) {
      throw new Error('Invalid Solana transaction signature');
    }
    decoded = decoded * BigInt(58) + BigInt(digit);
  }

  const bytes: number[] = [];
  while (decoded > BigInt(0)) {
    bytes.push(Number(decoded % BigInt(256)));
    decoded /= BigInt(256);
  }
  bytes.reverse();

  let leadingZeroCount = 0;
  for (const character of value) {
    if (character !== '1') {
      break;
    }
    leadingZeroCount += 1;
  }

  return Uint8Array.from([...new Array(leadingZeroCount).fill(0), ...bytes]);
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(input: Uint8Array): Uint8Array {
  const bitLength = input.length * 8;
  const withOneByteLength = input.length + 1;
  const zeroPaddingLength = (64 - ((withOneByteLength + 8) % 64)) % 64;
  const totalLength = withOneByteLength + zeroPaddingLength + 8;
  const padded = new Uint8Array(totalLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const lengthView = new DataView(padded.buffer);
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  lengthView.setUint32(totalLength - 8, highBits, false);
  lengthView.setUint32(totalLength - 4, lowBits, false);

  const hash: number[] = [...SHA256_INITIAL_HASH];
  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const start = offset + i * 4;
      schedule[i] =
        ((padded[start]! << 24)
        | (padded[start + 1]! << 16)
        | (padded[start + 2]! << 8)
        | padded[start + 3]!) >>> 0;
    }

    for (let i = 16; i < 64; i++) {
      const s0 = (
        rotateRight(schedule[i - 15]!, 7)
        ^ rotateRight(schedule[i - 15]!, 18)
        ^ (schedule[i - 15]! >>> 3)
      ) >>> 0;
      const s1 = (
        rotateRight(schedule[i - 2]!, 17)
        ^ rotateRight(schedule[i - 2]!, 19)
        ^ (schedule[i - 2]! >>> 10)
      ) >>> 0;
      schedule[i] = (
        schedule[i - 16]!
        + s0
        + schedule[i - 7]!
        + s1
      ) >>> 0;
    }

    let a = hash[0]!;
    let b = hash[1]!;
    let c = hash[2]!;
    let d = hash[3]!;
    let e = hash[4]!;
    let f = hash[5]!;
    let g = hash[6]!;
    let h = hash[7]!;

    for (let i = 0; i < 64; i++) {
      const sigma1 = (
        rotateRight(e, 6)
        ^ rotateRight(e, 11)
        ^ rotateRight(e, 25)
      ) >>> 0;
      const choose = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + sigma1 + choose + SHA256_ROUND_CONSTANTS[i]! + schedule[i]!) >>> 0;
      const sigma0 = (
        rotateRight(a, 2)
        ^ rotateRight(a, 13)
        ^ rotateRight(a, 22)
      ) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0]! + a) >>> 0;
    hash[1] = (hash[1]! + b) >>> 0;
    hash[2] = (hash[2]! + c) >>> 0;
    hash[3] = (hash[3]! + d) >>> 0;
    hash[4] = (hash[4]! + e) >>> 0;
    hash[5] = (hash[5]! + f) >>> 0;
    hash[6] = (hash[6]! + g) >>> 0;
    hash[7] = (hash[7]! + h) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  hash.forEach((value, index) => {
    outputView.setUint32(index * 4, value, false);
  });
  return output;
}

function txHashToChunks(chain: OraclePayload['chain'], txHash: string, numChunks: number): string[] {
  if (chain === 'solana') {
    const signatureBytes = decodeBase58(txHash);
    const digest = sha256(signatureBytes);
    return bytesToChunks(digest, numChunks);
  }

  return hexToChunks(txHash, numChunks);
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

  if (!['0', '1', '2'].includes(witness.chainId)) {
    errors.push(
      `Chain ID must be 0 (bitcoin), 1 (ethereum), or 2 (solana), got ${witness.chainId}`
    );
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
