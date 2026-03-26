import rawPoseidonConstants from '@/lib/zk/poseidon-constants-opt-subset.json';

type PoseidonWidth = 5 | 9;

interface ParsedPoseidonConstants {
  C: bigint[];
  M: bigint[][];
  P: bigint[][];
  roundsP: number;
  S: bigint[];
  width: PoseidonWidth;
}

interface RawPoseidonConstants {
  C: string[][];
  M: string[][][];
  P: string[][][];
  S: string[][];
}

const FIELD_MODULUS = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);
const N_ROUNDS_F = 8;
const N_ROUNDS_P_BY_WIDTH: Record<PoseidonWidth, number> = {
  5: 60,
  9: 63,
};
const SUBSET_INDEX_BY_WIDTH: Record<PoseidonWidth, number> = {
  5: 0,
  9: 1,
};
const parsedConstantCache = new Map<PoseidonWidth, ParsedPoseidonConstants>();
const POSEIDON_CONSTANTS = rawPoseidonConstants as RawPoseidonConstants;

function modField(value: bigint): bigint {
  const remainder = value % FIELD_MODULUS;
  return remainder >= 0n ? remainder : remainder + FIELD_MODULUS;
}

function addField(left: bigint, right: bigint): bigint {
  return modField(left + right);
}

function mulField(left: bigint, right: bigint): bigint {
  return modField(left * right);
}

function pow5(value: bigint): bigint {
  const square = mulField(value, value);
  const fourth = mulField(square, square);
  return mulField(fourth, value);
}

function parseBigIntVector(values: string[]): bigint[] {
  return values.map((value) => modField(BigInt(value)));
}

function parseBigIntMatrix(values: string[][]): bigint[][] {
  return values.map((row) => parseBigIntVector(row));
}

function addRoundConstants(
  state: bigint[],
  constants: bigint[],
  offset: number
): bigint[] {
  return state.map((value, index) => addField(value, constants[offset + index]!));
}

function multiplyStateByMatrix(state: bigint[], matrix: bigint[][]): bigint[] {
  const width = state.length;
  const output: bigint[] = new Array<bigint>(width).fill(0n);

  for (let column = 0; column < width; column += 1) {
    let acc = 0n;
    for (let row = 0; row < width; row += 1) {
      acc = addField(acc, mulField(matrix[row]![column]!, state[row]!));
    }
    output[column] = acc;
  }

  return output;
}

function parsePoseidonConstants(width: PoseidonWidth): ParsedPoseidonConstants {
  const subsetIndex = SUBSET_INDEX_BY_WIDTH[width];
  const rawC = POSEIDON_CONSTANTS.C[subsetIndex];
  const rawS = POSEIDON_CONSTANTS.S[subsetIndex];
  const rawM = POSEIDON_CONSTANTS.M[subsetIndex];
  const rawP = POSEIDON_CONSTANTS.P[subsetIndex];

  if (!rawC || !rawS || !rawM || !rawP) {
    throw new Error(`Missing Poseidon constants for width ${String(width)}`);
  }

  return {
    C: parseBigIntVector(rawC),
    M: parseBigIntMatrix(rawM),
    P: parseBigIntMatrix(rawP),
    roundsP: N_ROUNDS_P_BY_WIDTH[width],
    S: parseBigIntVector(rawS),
    width,
  };
}

function getPoseidonConstants(width: PoseidonWidth): ParsedPoseidonConstants {
  const cached = parsedConstantCache.get(width);
  if (cached) {
    return cached;
  }

  const parsed = parsePoseidonConstants(width);
  parsedConstantCache.set(width, parsed);
  return parsed;
}

/**
 * Wasm-free Poseidon permutation compatible with circomlibjs poseidon_opt.
 * Supports arity-4 and arity-8 inputs (used by oracle commitment construction).
 */
export function poseidonHash(inputs: bigint[]): bigint {
  if (inputs.length !== 4 && inputs.length !== 8) {
    throw new Error(`Unsupported Poseidon arity: ${String(inputs.length)}`);
  }

  const width = (inputs.length + 1) as PoseidonWidth;
  const constants = getPoseidonConstants(width);

  let state = [0n, ...inputs.map((value) => modField(value))];
  state = addRoundConstants(state, constants.C, 0);

  for (let round = 0; round < N_ROUNDS_F / 2 - 1; round += 1) {
    state = state.map((value) => pow5(value));
    state = addRoundConstants(state, constants.C, (round + 1) * width);
    state = multiplyStateByMatrix(state, constants.M);
  }

  state = state.map((value) => pow5(value));
  state = addRoundConstants(state, constants.C, (N_ROUNDS_F / 2) * width);
  state = multiplyStateByMatrix(state, constants.P);

  const sStride = width * 2 - 1;
  for (let round = 0; round < constants.roundsP; round += 1) {
    state[0] = pow5(state[0]!);
    state[0] = addField(
      state[0]!,
      constants.C[(N_ROUNDS_F / 2 + 1) * width + round]!
    );

    const sOffset = sStride * round;
    let s0 = 0n;
    for (let position = 0; position < width; position += 1) {
      s0 = addField(
        s0,
        mulField(constants.S[sOffset + position]!, state[position]!)
      );
    }

    for (let position = 1; position < width; position += 1) {
      state[position] = addField(
        state[position]!,
        mulField(
          state[0]!,
          constants.S[sOffset + width + position - 1]!
        )
      );
    }
    state[0] = s0;
  }

  for (let round = 0; round < N_ROUNDS_F / 2 - 1; round += 1) {
    state = state.map((value) => pow5(value));
    state = addRoundConstants(
      state,
      constants.C,
      (N_ROUNDS_F / 2 + 1) * width + constants.roundsP + round * width
    );
    state = multiplyStateByMatrix(state, constants.M);
  }

  state = state.map((value) => pow5(value));
  state = multiplyStateByMatrix(state, constants.M);

  return state[0]!;
}

export function __resetPoseidonConstantsCacheForTests(): void {
  parsedConstantCache.clear();
}
