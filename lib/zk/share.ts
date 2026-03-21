export interface VerifiedReceiptClaims {
  claimedAmount: string;
  minDateUnix: number;
  minDateIsoUtc: string;
}

/**
 * Extract verified user-claim fields from circuit public signals.
 * Signal order is defined in witness.extractPublicSignals:
 * [claimedAmount, minDate, ...oracleSignatureChunks]
 */
export function extractVerifiedClaims(
  publicSignals: string[]
): VerifiedReceiptClaims {
  if (publicSignals.length < 2) {
    throw new Error('Invalid proof: insufficient public signals');
  }

  const claimedAmount = publicSignals[0];
  const minDateRaw = publicSignals[1];

  if (!claimedAmount || !minDateRaw) {
    throw new Error('Invalid proof: missing claim fields in public signals');
  }

  const minDateUnix = Number(minDateRaw);
  if (!Number.isSafeInteger(minDateUnix) || minDateUnix <= 0) {
    throw new Error('Invalid proof: malformed minimum date signal');
  }

  const minDateIsoUtc = new Date(minDateUnix * 1000).toISOString().slice(0, 10);

  return {
    claimedAmount,
    minDateUnix,
    minDateIsoUtc,
  };
}
