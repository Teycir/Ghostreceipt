declare module 'circomlibjs' {
  export interface PoseidonHash {
    (inputs: bigint[]): unknown;
    F: {
      toString(value: unknown): string;
    };
  }

  export function buildPoseidon(): Promise<PoseidonHash>;
}
