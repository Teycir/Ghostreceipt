export interface VerifiedReceiptClaims {
  claimedAmount: string;
  minDateUnix: number;
  minDateIsoUtc: string;
}

export type ReceiptClaimDisclosureState = 'disclosed' | 'hidden';
export type ReceiptSignalContract = 'legacy-v1' | 'selective-disclosure-v1';

export interface SelectiveDisclosureClaimDigestInput {
  claimedAmount: string;
  disclosureMask: number;
  minDateUnix: number;
}

export interface SelectiveDisclosurePublicSignalInput extends SelectiveDisclosureClaimDigestInput {
  oracleCommitment: string;
}

interface DecodedReceiptPublicSignalBase {
  claimDigest: string | null;
  claimedAmount: string | null;
  claimedAmountDisclosure: ReceiptClaimDisclosureState;
  contract: ReceiptSignalContract;
  disclosureMask: number;
  minDateDisclosure: ReceiptClaimDisclosureState;
  minDateIsoUtc: string | null;
  minDateUnix: number | null;
  oracleCommitment: string;
}

export interface DecodedLegacyReceiptPublicSignals extends DecodedReceiptPublicSignalBase {
  claimDigest: null;
  claimedAmount: string;
  claimedAmountDisclosure: 'disclosed';
  contract: 'legacy-v1';
  disclosureMask: 3;
  minDateDisclosure: 'disclosed';
  minDateIsoUtc: string;
  minDateUnix: number;
  oracleCommitment: string;
}

export interface DecodedSelectiveDisclosureReceiptPublicSignals extends DecodedReceiptPublicSignalBase {
  claimDigest: string;
  contract: 'selective-disclosure-v1';
}

export type DecodedReceiptPublicSignals =
  | DecodedLegacyReceiptPublicSignals
  | DecodedSelectiveDisclosureReceiptPublicSignals;

interface DecodeLegacyReceiptPublicSignalsOptions {
  expectedOracleCommitment?: string;
}

interface LegacyReceiptPublicSignalIndex {
  claimedAmount: number;
  minDate: number;
  oracleCommitment: number;
}

interface SelectiveDisclosurePublicSignalIndex {
  claimDigest: number;
  disclosedClaimedAmount: number;
  disclosedMinDate: number;
  disclosureMask: number;
  oracleCommitment: number;
}

const LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX: Readonly<LegacyReceiptPublicSignalIndex> = Object.freeze({
  claimedAmount: 0,
  minDate: 1,
  oracleCommitment: 2,
});
const LEGACY_VALID_PREFIX_OFFSET = 1;

const SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX: Readonly<SelectiveDisclosurePublicSignalIndex> =
  Object.freeze({
    oracleCommitment: 0,
    disclosureMask: 1,
    disclosedClaimedAmount: 2,
    disclosedMinDate: 3,
    claimDigest: 4,
  });

function toIsoDate(minDateUnix: number): string {
  return new Date(minDateUnix * 1000).toISOString().slice(0, 10);
}

function parseMinDateSignal(minDateRaw: string): number {
  const minDateUnix = Number(minDateRaw);
  if (!Number.isSafeInteger(minDateUnix) || minDateUnix <= 0) {
    throw new Error('Invalid proof: malformed minimum date signal');
  }
  return minDateUnix;
}

function parseDisclosureMaskSignal(rawMask: string): number {
  const disclosureMask = Number(rawMask);
  if (!Number.isSafeInteger(disclosureMask) || disclosureMask < 0 || disclosureMask > 3) {
    throw new Error('Invalid proof: malformed disclosure mask signal');
  }
  return disclosureMask;
}

function isAmountDisclosed(disclosureMask: number): boolean {
  return (disclosureMask & 0b01) !== 0;
}

function isMinDateDisclosed(disclosureMask: number): boolean {
  return (disclosureMask & 0b10) !== 0;
}

function readSignal(publicSignals: string[], index: number): string {
  if (publicSignals.length <= index) {
    throw new Error('Invalid proof: insufficient public signals');
  }

  const value = publicSignals[index];
  if (value === undefined) {
    throw new Error('Invalid proof: insufficient public signals');
  }

  return value;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function decodeLegacyReceiptPublicSignalsAtOffset(
  publicSignals: string[],
  offset: number
): DecodedLegacyReceiptPublicSignals {
  const oracleIndex = LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment + offset;
  if (publicSignals.length <= oracleIndex) {
    throw new Error('Invalid proof: insufficient public signals');
  }

  const claimedAmount = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.claimedAmount + offset];
  const minDateRaw = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.minDate + offset];
  const oracleCommitment = publicSignals[oracleIndex];

  if (!claimedAmount || !minDateRaw) {
    throw new Error('Invalid proof: missing claim fields in public signals');
  }
  if (!oracleCommitment) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  const minDateUnix = parseMinDateSignal(minDateRaw);
  const minDateIsoUtc = toIsoDate(minDateUnix);

  return {
    contract: 'legacy-v1',
    oracleCommitment,
    disclosureMask: 3,
    claimDigest: null,
    claimedAmount,
    claimedAmountDisclosure: 'disclosed',
    minDateUnix,
    minDateIsoUtc,
    minDateDisclosure: 'disclosed',
  };
}

export function decodeLegacyReceiptPublicSignals(
  publicSignals: string[],
  options: DecodeLegacyReceiptPublicSignalsOptions = {}
): DecodedLegacyReceiptPublicSignals {
  const expectedOracleCommitment = options.expectedOracleCommitment?.trim();
  if (expectedOracleCommitment) {
    const directOracleSignal = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment];
    if (directOracleSignal === expectedOracleCommitment) {
      return decodeLegacyReceiptPublicSignalsAtOffset(publicSignals, 0);
    }

    const prefixedOracleSignal =
      publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment + LEGACY_VALID_PREFIX_OFFSET];
    if (prefixedOracleSignal === expectedOracleCommitment) {
      return decodeLegacyReceiptPublicSignalsAtOffset(publicSignals, LEGACY_VALID_PREFIX_OFFSET);
    }
  }

  return decodeLegacyReceiptPublicSignalsAtOffset(publicSignals, 0);
}

export function decodeSelectiveDisclosureReceiptPublicSignals(
  publicSignals: string[]
): DecodedSelectiveDisclosureReceiptPublicSignals {
  const oracleCommitment = readSignal(publicSignals, SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.oracleCommitment);
  const disclosureMaskRaw = readSignal(publicSignals, SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.disclosureMask);
  const disclosedClaimedAmount = readSignal(
    publicSignals,
    SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.disclosedClaimedAmount
  );
  const disclosedMinDateRaw = readSignal(
    publicSignals,
    SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.disclosedMinDate
  );
  const claimDigest = readSignal(publicSignals, SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.claimDigest);

  if (!oracleCommitment) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }
  if (!disclosureMaskRaw) {
    throw new Error('Invalid proof: missing disclosure mask signal');
  }
  if (!claimDigest) {
    throw new Error('Invalid proof: missing claim digest signal');
  }

  const disclosureMask = parseDisclosureMaskSignal(disclosureMaskRaw);
  const amountDisclosed = isAmountDisclosed(disclosureMask);
  const minDateDisclosed = isMinDateDisclosed(disclosureMask);

  let claimedAmount: string | null = null;
  if (amountDisclosed) {
    if (!disclosedClaimedAmount || disclosedClaimedAmount === '0') {
      throw new Error('Invalid proof: amount disclosure signal does not match mask');
    }
    claimedAmount = disclosedClaimedAmount;
  } else if (disclosedClaimedAmount !== '0') {
    throw new Error('Invalid proof: amount disclosure signal does not match mask');
  }

  let minDateUnix: number | null = null;
  let minDateIsoUtc: string | null = null;
  if (minDateDisclosed) {
    minDateUnix = parseMinDateSignal(disclosedMinDateRaw);
    minDateIsoUtc = toIsoDate(minDateUnix);
  } else if (disclosedMinDateRaw !== '0') {
    throw new Error('Invalid proof: minimum date disclosure signal does not match mask');
  }

  return {
    contract: 'selective-disclosure-v1',
    oracleCommitment,
    disclosureMask,
    claimDigest,
    claimedAmount,
    claimedAmountDisclosure: amountDisclosed ? 'disclosed' : 'hidden',
    minDateUnix,
    minDateIsoUtc,
    minDateDisclosure: minDateDisclosed ? 'disclosed' : 'hidden',
  };
}

export function decodeReceiptPublicSignals(
  publicSignals: string[],
  expectedOracleCommitment: string
): DecodedReceiptPublicSignals {
  if (!expectedOracleCommitment) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  const hasSelectiveShape =
    publicSignals.length > SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.claimDigest;
  const selectiveOracleSignal = publicSignals[SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.oracleCommitment];
  if (hasSelectiveShape && selectiveOracleSignal && selectiveOracleSignal === expectedOracleCommitment) {
    return decodeSelectiveDisclosureReceiptPublicSignals(publicSignals);
  }

  const legacyOracleSignal = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment];
  if (legacyOracleSignal && legacyOracleSignal === expectedOracleCommitment) {
    return decodeLegacyReceiptPublicSignals(publicSignals, { expectedOracleCommitment });
  }

  const prefixedLegacyOracleSignal =
    publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment + LEGACY_VALID_PREFIX_OFFSET];
  if (prefixedLegacyOracleSignal && prefixedLegacyOracleSignal === expectedOracleCommitment) {
    return decodeLegacyReceiptPublicSignals(publicSignals, { expectedOracleCommitment });
  }

  const hasOracleSignal =
    Boolean(selectiveOracleSignal) ||
    Boolean(legacyOracleSignal) ||
    Boolean(prefixedLegacyOracleSignal);
  if (!hasOracleSignal) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  throw new Error('Oracle commitment mismatch detected');
}

function validateSelectiveDisclosureInput(
  input: SelectiveDisclosureClaimDigestInput
): void {
  if (!input.claimedAmount.trim()) {
    throw new Error('Invalid proof: missing claimed amount');
  }
  if (!Number.isSafeInteger(input.minDateUnix) || input.minDateUnix <= 0) {
    throw new Error('Invalid proof: malformed minimum date signal');
  }
  parseDisclosureMaskSignal(String(input.disclosureMask));
}

/**
 * Deterministic digest used in selective payload packaging while legacy circuit remains active.
 * This digest binds disclosed/hidden rendering fields to proven legacy claim values + mask.
 */
export async function deriveSelectiveClaimDigest(
  input: SelectiveDisclosureClaimDigestInput
): Promise<string> {
  validateSelectiveDisclosureInput(input);

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API unavailable');
  }

  const payload = `claimedAmount=${input.claimedAmount}&minDateUnix=${input.minDateUnix}&disclosureMask=${input.disclosureMask}`;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return toHex(digest);
}

export async function buildSelectiveDisclosurePublicSignals(
  input: SelectiveDisclosurePublicSignalInput
): Promise<string[]> {
  validateSelectiveDisclosureInput(input);

  if (!input.oracleCommitment.trim()) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  const claimDigest = await deriveSelectiveClaimDigest(input);
  const amountDisclosed = isAmountDisclosed(input.disclosureMask);
  const minDateDisclosed = isMinDateDisclosed(input.disclosureMask);

  return [
    input.oracleCommitment,
    String(input.disclosureMask),
    amountDisclosed ? input.claimedAmount : '0',
    minDateDisclosed ? String(input.minDateUnix) : '0',
    claimDigest,
  ];
}

/**
 * Extract verified user-claim fields from legacy circuit public signals.
 * Signal order is defined in witness.extractPublicSignals:
 * [claimedAmount, minDate, oracleCommitment]
 */
export function extractVerifiedClaims(
  publicSignals: string[]
): VerifiedReceiptClaims {
  const decoded = decodeLegacyReceiptPublicSignals(publicSignals);
  return {
    claimedAmount: decoded.claimedAmount,
    minDateUnix: decoded.minDateUnix,
    minDateIsoUtc: decoded.minDateIsoUtc,
  };
}

export function extractOracleCommitment(publicSignals: string[]): string {
  return decodeLegacyReceiptPublicSignals(publicSignals).oracleCommitment;
}
