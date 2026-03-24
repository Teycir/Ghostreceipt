import {
  decodeLegacyReceiptPublicSignals,
  decodeReceiptPublicSignals,
  decodeSelectiveDisclosureReceiptPublicSignals,
  extractOracleCommitment,
  extractVerifiedClaims,
} from '@/lib/zk/share';

describe('extractVerifiedClaims', () => {
  it('extracts claimed amount and minimum date from public signals', () => {
    const claims = extractVerifiedClaims([
      '123450000',
      '1700000000',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);

    expect(claims.claimedAmount).toBe('123450000');
    expect(claims.minDateUnix).toBe(1700000000);
    expect(claims.minDateIsoUtc).toBe('2023-11-14');
  });

  it('throws when required claim signals are missing', () => {
    expect(() => extractVerifiedClaims(['123450000'])).toThrow(
      'Invalid proof: insufficient public signals'
    );
  });

  it('throws when minimum date signal is malformed', () => {
    expect(() =>
      extractVerifiedClaims([
        '123450000',
        'not-a-number',
        '1',
        '2',
      ])
    ).toThrow('Invalid proof: malformed minimum date signal');
  });
});

describe('extractOracleCommitment', () => {
  it('extracts oracle commitment from public signals', () => {
    const commitment = extractOracleCommitment([
      '123450000',
      '1700000000',
      'oracle-commitment',
      'unused',
    ]);

    expect(commitment).toBe('oracle-commitment');
  });

  it('throws when oracle commitment signal is missing', () => {
    expect(() => extractOracleCommitment(['123450000', '1700000000'])).toThrow(
      'Invalid proof: insufficient public signals'
    );
  });
});

describe('decodeLegacyReceiptPublicSignals', () => {
  it('decodes legacy claims and oracle commitment from one canonical helper', () => {
    const decoded = decodeLegacyReceiptPublicSignals([
      '123450000',
      '1700000000',
      'oracle-commitment',
      'unused',
    ]);

    expect(decoded).toEqual({
      contract: 'legacy-v1',
      oracleCommitment: 'oracle-commitment',
      disclosureMask: 3,
      claimDigest: null,
      claimedAmount: '123450000',
      claimedAmountDisclosure: 'disclosed',
      minDateUnix: 1700000000,
      minDateIsoUtc: '2023-11-14',
      minDateDisclosure: 'disclosed',
    });
  });
});

describe('decodeSelectiveDisclosureReceiptPublicSignals', () => {
  it('decodes selective-disclosure signals when both claims are disclosed', () => {
    const decoded = decodeSelectiveDisclosureReceiptPublicSignals([
      'oracle-commitment',
      '3',
      '123450000',
      '1700000000',
      'claim-digest-1',
      'padding',
    ]);

    expect(decoded).toEqual({
      contract: 'selective-disclosure-v1',
      oracleCommitment: 'oracle-commitment',
      disclosureMask: 3,
      claimDigest: 'claim-digest-1',
      claimedAmount: '123450000',
      claimedAmountDisclosure: 'disclosed',
      minDateUnix: 1700000000,
      minDateIsoUtc: '2023-11-14',
      minDateDisclosure: 'disclosed',
    });
  });

  it('decodes selective-disclosure signals when both claims are hidden', () => {
    const decoded = decodeSelectiveDisclosureReceiptPublicSignals([
      'oracle-commitment',
      '0',
      '0',
      '0',
      'claim-digest-2',
    ]);

    expect(decoded).toEqual({
      contract: 'selective-disclosure-v1',
      oracleCommitment: 'oracle-commitment',
      disclosureMask: 0,
      claimDigest: 'claim-digest-2',
      claimedAmount: null,
      claimedAmountDisclosure: 'hidden',
      minDateUnix: null,
      minDateIsoUtc: null,
      minDateDisclosure: 'hidden',
    });
  });

  it('rejects amount signals that do not match the disclosure mask', () => {
    expect(() =>
      decodeSelectiveDisclosureReceiptPublicSignals([
        'oracle-commitment',
        '0',
        '123450000',
        '0',
        'claim-digest-3',
      ])
    ).toThrow('Invalid proof: amount disclosure signal does not match mask');
  });
});

describe('decodeReceiptPublicSignals', () => {
  it('resolves legacy contract when expected commitment matches legacy slot', () => {
    const decoded = decodeReceiptPublicSignals(
      ['123450000', '1700000000', 'oracle-legacy', 'unused'],
      'oracle-legacy'
    );

    expect(decoded.contract).toBe('legacy-v1');
  });

  it('resolves selective contract when expected commitment matches selective slot', () => {
    const decoded = decodeReceiptPublicSignals(
      ['oracle-selective', '0', '0', '0', 'claim-digest-4'],
      'oracle-selective'
    );

    expect(decoded.contract).toBe('selective-disclosure-v1');
    expect(decoded.claimedAmountDisclosure).toBe('hidden');
  });

  it('throws when oracle commitment does not match any supported slot', () => {
    expect(() =>
      decodeReceiptPublicSignals(
        ['oracle-a', '1700000000', 'oracle-b', 'unused'],
        'oracle-c'
      )
    ).toThrow('Oracle commitment mismatch detected');
  });
});
