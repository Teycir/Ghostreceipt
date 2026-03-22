import { buildPoseidon } from 'circomlibjs';
import type { CanonicalTxData, Chain } from '@/lib/validation/schemas';

type PoseidonHash = ((inputs: bigint[]) => unknown) & {
  F: {
    toString(value: unknown): string;
  };
};

let poseidonPromise: Promise<PoseidonHash> | null = null;

function getPoseidon(): Promise<PoseidonHash> {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon() as Promise<PoseidonHash>;
  }

  return poseidonPromise;
}

function chainToId(chain: Chain): bigint {
  return chain === 'bitcoin' ? BigInt(0) : BigInt(1);
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

export async function computeOracleCommitment(data: CanonicalTxData): Promise<string> {
  const poseidon = await getPoseidon();
  const txHashChunks = hexToChunks(data.txHash, 8);
  const txHashCommitment = poseidon(txHashChunks);
  const commitment = poseidon([
    BigInt(data.valueAtomic),
    BigInt(data.timestampUnix),
    txHashCommitment as bigint,
    chainToId(data.chain),
  ]);

  return poseidon.F.toString(commitment);
}
