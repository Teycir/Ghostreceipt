import { buildPoseidon } from 'circomlibjs';
import { poseidonHash } from '@/lib/zk/poseidon-opt';

type PoseidonReference = ((inputs: bigint[]) => unknown) & {
  F: {
    toString(value: unknown): string;
  };
};

describe('poseidonHash', () => {
  let poseidon: PoseidonReference;

  beforeAll(async () => {
    poseidon = (await buildPoseidon()) as PoseidonReference;
  });

  function referenceHash(inputs: bigint[]): string {
    return poseidon.F.toString(poseidon(inputs));
  }

  it('matches circomlibjs for arity-4 inputs', () => {
    const inputs = [
      BigInt(1),
      BigInt(2),
      BigInt(3),
      BigInt(4),
    ];

    expect(poseidonHash(inputs).toString()).toBe(referenceHash(inputs));
  });

  it('matches circomlibjs for arity-8 inputs', () => {
    const inputs = [
      BigInt('4294967295'),
      BigInt('123456789'),
      BigInt('987654321'),
      BigInt('777777777'),
      BigInt('888888888'),
      BigInt('999999999'),
      BigInt('135792468'),
      BigInt('246813579'),
    ];

    expect(poseidonHash(inputs).toString()).toBe(referenceHash(inputs));
  });
});
