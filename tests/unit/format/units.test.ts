import { amountPlaceholder, atomicUnitLabel, formatAtomicAmount, toHumanAmount } from '@/lib/format/units';

describe('format units', () => {
  it('formats native ethereum amounts as ETH by default', () => {
    expect(formatAtomicAmount('1000000000000000000', 'ethereum')).toBe('≈ 1 ETH');
    expect(toHumanAmount('1000000000000000000', 'ethereum')).toBe('1 ETH');
    expect(atomicUnitLabel('ethereum')).toBe('wei');
  });

  it('formats ethereum usdc amounts using 6-decimal base units', () => {
    expect(formatAtomicAmount('1000000', 'ethereum', 'usdc')).toBe('≈ 1 USDC');
    expect(toHumanAmount('2500000', 'ethereum', 'usdc')).toBe('2.5 USDC');
    expect(atomicUnitLabel('ethereum', 'usdc')).toBe('USDC base units');
    expect(amountPlaceholder('ethereum', 'usdc')).toContain('1 USDC');
  });

  it('keeps bitcoin behavior unchanged', () => {
    expect(formatAtomicAmount('100000000', 'bitcoin')).toBe('≈ 1 BTC');
    expect(toHumanAmount('100000000', 'bitcoin')).toBe('1 BTC');
    expect(atomicUnitLabel('bitcoin')).toBe('satoshis');
  });
});
