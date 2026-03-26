import { generateQRDataUrlWithFallback } from '@/lib/generator/use-receipt-share';

describe('generateQRDataUrlWithFallback', () => {
  it('falls back to lower error correction levels when higher levels fail', async () => {
    const toDataUrl = jest
      .fn<Promise<string>, [string, { errorCorrectionLevel: 'H' | 'Q' | 'M' | 'L' }]>()
      .mockRejectedValueOnce(new Error('Data too long for H'))
      .mockRejectedValueOnce(new Error('Data too long for Q'))
      .mockResolvedValueOnce('data:image/png;base64,ok');

    const result = await generateQRDataUrlWithFallback('https://example.test/verify?proof=abc', toDataUrl);

    expect(result).toBe('data:image/png;base64,ok');
    expect(toDataUrl).toHaveBeenCalledTimes(3);
    expect(toDataUrl.mock.calls.map((call) => call[1].errorCorrectionLevel)).toEqual(['H', 'Q', 'M']);
  });

  it('throws when QR generation fails across all supported levels', async () => {
    const toDataUrl = jest
      .fn<Promise<string>, [string, { errorCorrectionLevel: 'H' | 'Q' | 'M' | 'L' }]>()
      .mockRejectedValue(new Error('Data too long for all levels'));

    await expect(
      generateQRDataUrlWithFallback('https://example.test/verify?proof=abc', toDataUrl)
    ).rejects.toThrow('Data too long for all levels');

    expect(toDataUrl).toHaveBeenCalledTimes(4);
    expect(toDataUrl.mock.calls.map((call) => call[1].errorCorrectionLevel)).toEqual(['H', 'Q', 'M', 'L']);
  });
});
