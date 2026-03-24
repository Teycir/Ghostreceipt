import { buildReceiptPdfHtml } from '@/lib/generator/pdf-export';

describe('buildReceiptPdfHtml', () => {
  const baseData = {
    chain: 'bitcoin' as const,
    claimedAmount: '100000000',
    claimedAmountHuman: '1 BTC',
    minDate: '2026-03-24',
    proof: 'proof_payload_abcdefghijklmnopqrstuvwxyz0123456789',
    qrCodeDataUrl: 'data:image/png;base64,ABC123',
    verifyUrl: 'https://ghostreceipt.example/verify?proof=abc123',
  };

  it('renders human-readable summary content and qr image', () => {
    const html = buildReceiptPdfHtml(baseData, new Date('2026-03-24T12:00:00.000Z'));

    expect(html).toContain('GhostReceipt Proof Receipt');
    expect(html).toContain('Receipt Summary');
    expect(html).toContain('Verification QR');
    expect(html).toContain('Bitcoin');
    expect(html).toContain('100000000 (1 BTC)');
    expect(html).toContain('2026-03-24T12:00:00.000Z');
    expect(html).toContain('data:image/png;base64,ABC123');
  });

  it('escapes html-sensitive values to avoid html injection in exported document', () => {
    const html = buildReceiptPdfHtml(
      {
        ...baseData,
        claimedAmount: '1<script>alert("x")</script>',
        claimedAmountHuman: '2 & 3',
        minDate: '<b>2026-03-24</b>',
        proof: '<img src=x onerror=alert(1)>',
        verifyUrl: 'https://host.test/verify?proof=<dangerous>',
      },
      new Date('2026-03-24T12:00:00.000Z')
    );

    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('2 &amp; 3');
    expect(html).toContain('&lt;b&gt;2026-03-24&lt;/b&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('proof=&lt;dangerous&gt;');
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it('uses qr fallback message when qr data url is unavailable', () => {
    const html = buildReceiptPdfHtml(
      {
        ...baseData,
        qrCodeDataUrl: '',
      },
      new Date('2026-03-24T12:00:00.000Z')
    );

    expect(html).toContain('QR code unavailable. Use the verification URL below.');
  });
});
