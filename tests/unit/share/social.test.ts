import {
  buildShareBundleText,
  buildSharePayload,
  deriveVerificationCode,
} from '@/lib/share/social';

describe('share social helpers', () => {
  it('builds share payload text with chain label', () => {
    const payload = buildSharePayload('https://example.com/verify?proof=abc', 'bitcoin');

    expect(payload.title).toBe('GhostReceipt Verification Link');
    expect(payload.text).toContain('privacy-preserving bitcoin receipt');
  });

  it('derives a stable short verification code from proof input', () => {
    const code = deriveVerificationCode('abc123XYZ789proof');

    expect(code).toBe('ABC1-XYZ7-ROOF');
  });

  it('builds copy-all share packet text with link and verification code', () => {
    const text = buildShareBundleText({
      chain: 'solana',
      proof: 'abc123XYZ789proof',
      verifyUrl: 'https://example.com/verify?proof=abc123XYZ789proof',
    });

    expect(text).toContain('Verification Packet');
    expect(text).toContain('Chain: SOLANA');
    expect(text).toContain('Verification code: ABC1-XYZ7-ROOF');
    expect(text).toContain('Verify link: https://example.com/verify?proof=abc123XYZ789proof');
  });
});
