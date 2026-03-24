export interface VerifiedReceiptClaims {
  claimedAmount: string;
  minDateUnix: number;
  minDateIsoUtc: string;
}

export interface DecodedLegacyReceiptPublicSignals extends VerifiedReceiptClaims {
  oracleCommitment: string;
}

const LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX = Object.freeze({
  claimedAmount: 0,
  minDate: 1,
  oracleCommitment: 2,
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

/**
 * Extract verified user-claim fields from circuit public signals.
 * Signal order is defined in witness.extractPublicSignals:
 * [claimedAmount, minDate, oracleCommitment]
 */
export function extractVerifiedClaims(
  publicSignals: string[]
): VerifiedReceiptClaims {
  if (publicSignals.length <= LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.minDate) {
    throw new Error('Invalid proof: insufficient public signals');
  }

  const claimedAmount = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.claimedAmount];
  const minDateRaw = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.minDate];

  if (!claimedAmount || !minDateRaw) {
    throw new Error('Invalid proof: missing claim fields in public signals');
  }

  const minDateUnix = parseMinDateSignal(minDateRaw);
  const minDateIsoUtc = toIsoDate(minDateUnix);

  return {
    claimedAmount,
    minDateUnix,
    minDateIsoUtc,
  };
}

export function extractOracleCommitment(publicSignals: string[]): string {
  if (publicSignals.length <= LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  const oracleCommitment = publicSignals[LEGACY_RECEIPT_PUBLIC_SIGNAL_INDEX.oracleCommitment];
  if (!oracleCommitment) {
    throw new Error('Invalid proof: missing oracle commitment signal');
  }

  return oracleCommitment;
}

export function decodeLegacyReceiptPublicSignals(
  publicSignals: string[]
): DecodedLegacyReceiptPublicSignals {
  const claims = extractVerifiedClaims(publicSignals);
  const oracleCommitment = extractOracleCommitment(publicSignals);

  return {
    ...claims,
    oracleCommitment,
  };
}
