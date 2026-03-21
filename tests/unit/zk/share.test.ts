import { extractVerifiedClaims } from '@/lib/zk/share';

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
