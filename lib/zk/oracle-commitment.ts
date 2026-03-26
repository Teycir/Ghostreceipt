import { createHash } from 'crypto';
import type { CanonicalTxData, Chain } from '@/lib/validation/schemas';
import { poseidonHash } from '@/lib/zk/poseidon-opt';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX_MAP = new Map<string, number>(
  BASE58_ALPHABET.split('').map((character, index) => [character, index])
);

function chainToId(chain: Chain): bigint {
  switch (chain) {
    case 'bitcoin':
      return BigInt(0);
    case 'ethereum':
      return BigInt(1);
    case 'solana':
      return BigInt(2);
    default:
      throw new Error(`Unsupported chain for oracle commitment: ${String(chain)}`);
  }
}

function hexToChunks(hex: string, numChunks: number): bigint[] {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const paddedHex = cleanHex.padStart(numChunks * 8, '0');
  const chunks: bigint[] = [];

  for (let i = 0; i < numChunks; i++) {
    const chunk = paddedHex.slice(i * 8, (i + 1) * 8);
    chunks.push(BigInt(`0x${chunk}`));
  }

  return chunks;
}

function bytesToChunks(bytes: Uint8Array, numChunks: number): bigint[] {
  const targetLength = numChunks * 4;
  const normalized = bytes.length >= targetLength
    ? bytes.slice(0, targetLength)
    : Uint8Array.from([...bytes, ...new Uint8Array(targetLength - bytes.length)]);

  const chunks: bigint[] = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * 4;
    const chunkValue =
      (normalized[start]! << 24) |
      (normalized[start + 1]! << 16) |
      (normalized[start + 2]! << 8) |
      normalized[start + 3]!;
    chunks.push(BigInt(chunkValue >>> 0));
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
      throw new Error('Invalid base58 value');
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

  const leadingZeros = new Array(leadingZeroCount).fill(0);
  return Uint8Array.from([...leadingZeros, ...bytes]);
}

function txHashToChunks(chain: Chain, txHash: string): bigint[] {
  if (chain === 'solana') {
    const signatureBytes = decodeBase58(txHash);
    const digest = createHash('sha256').update(signatureBytes).digest();
    return bytesToChunks(Uint8Array.from(digest), 8);
  }

  return hexToChunks(txHash, 8);
}

export async function computeOracleCommitment(data: CanonicalTxData): Promise<string> {
  const txHashChunks = txHashToChunks(data.chain, data.txHash);
  const txHashCommitment = poseidonHash(txHashChunks);
  const commitment = poseidonHash([
    BigInt(data.valueAtomic),
    BigInt(data.timestampUnix),
    txHashCommitment,
    chainToId(data.chain),
  ]);

  return commitment.toString();
}
