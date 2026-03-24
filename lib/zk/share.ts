export interface VerifiedReceiptClaims {
  claimedAmount: string;
  minDateUnix: number;
  minDateIsoUtc: string;
}

export type ReceiptClaimDisclosureState = 'disclosed' | 'hidden';
export type ReceiptSignalContract = 'legacy-v1' | 'selective-disclosure-v1';

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

export function decodeLegacyReceiptPublicSignals(
  publicSignals: string[]
): DecodedLegacyReceiptPublicSignals {
  if (publicSignals.length <= LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment) {
    throw new Error('Invalid proof: insufficient public signals');
  }

  const claimedAmount = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.claimedAmount];
  const minDateRaw = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.minDate];
  const oracleCommitment = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment];

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

  const selectiveOracleSignal = publicSignals[SELECTIVE_DISCLOSURE_PUBLIC_SIGNAL_INDEX.oracleCommitment];
  if (selectiveOracleSignal && selectiveOracleSignal === expectedOracleCommitment) {
    return decodeSelectiveDisclosureReceiptPublicSignals(publicSignals);
  }

  const legacyOracleSignal = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment];
  if (legacyOracleSignal && legacyOracleSignal === expectedOracleCommitment) {
    return decodeLegacyReceiptPublicSignals(publicSignals);
  }

  const hasOracleSignal = Boolean(selectiveOracleSignal) || Boolean(legacyOracleSignal);
  if (!hasOracleSignal) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  throw new Error('Oracle commitment mismatch detected');
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
