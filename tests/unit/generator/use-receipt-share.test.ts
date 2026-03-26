import { generateQRDataUrlWithFallback } from '@/lib/generator/use-receipt-share';

describe('generateQRDataUrlWithFallback', () => {
  it('falls back to lower error correction levels when higher levels fail', async () => {
    const toDataUrl = jest
      .fn<
        Promise<string>,
        [
          string,
          {
            color: { dark: string; light: string };
            errorCorrectionLevel: 'H' | 'Q' | 'M' | 'L';
            margin: number;
            width: number;
          },
        ]
      >()
      .mockRejectedValueOnce(new Error('Data too long for M'))
      .mockRejectedValueOnce(new Error('Data too long for L'))
      .mockResolvedValueOnce('data:image/png;base64,ok');

    const result = await generateQRDataUrlWithFallback('https://example.test/verify?proof=abc', toDataUrl);

    expect(result).toBe('data:image/png;base64,ok');
    expect(toDataUrl).toHaveBeenCalledTimes(3);
    expect(toDataUrl.mock.calls.map((call) => call[1].errorCorrectionLevel)).toEqual(['M', 'L', 'Q']);
    expect(toDataUrl.mock.calls[0]?.[1]).toMatchObject({
      color: { dark: '#000000', light: '#ffffff' },
      margin: 8,
      width: 384,
    });
  });

  it('throws when QR generation fails across all supported levels', async () => {
    const toDataUrl = jest
      .fn<
        Promise<string>,
        [
          string,
          {
            color: { dark: string; light: string };
            errorCorrectionLevel: 'H' | 'Q' | 'M' | 'L';
            margin: number;
            width: number;
          },
        ]
      >()
      .mockRejectedValue(new Error('Data too long for all levels'));

    await expect(
      generateQRDataUrlWithFallback('https://example.test/verify?proof=abc', toDataUrl)
    ).rejects.toThrow('Data too long for all levels');

    expect(toDataUrl).toHaveBeenCalledTimes(4);
    expect(toDataUrl.mock.calls.map((call) => call[1].errorCorrectionLevel)).toEqual(['M', 'L', 'Q', 'H']);
  });
});
