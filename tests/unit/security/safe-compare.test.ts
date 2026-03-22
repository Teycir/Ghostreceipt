import { safeHexEqual } from '@/lib/security/safe-compare';

describe('safeHexEqual', () => {
  it('returns true for equal values', () => {
    expect(safeHexEqual('abcdef1234567890', 'abcdef1234567890')).toBe(true);
  });

  it('returns false for different values', () => {
    expect(safeHexEqual('abcdef1234567890', 'abcdef1234567891')).toBe(false);
  });

  it('returns false for different-length values', () => {
    expect(safeHexEqual('abc', 'ab')).toBe(false);
  });
});
