import {
  detectChainFromTxHash,
  isValidTxHashForChain,
} from '@/lib/generator/tx-hash-detection';

describe('tx hash detection', () => {
  it('detects bitcoin hashes', () => {
    const result = detectChainFromTxHash(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );

    expect(result).toEqual({
      chain: 'bitcoin',
      ethereumAsset: 'native',
      label: 'Bitcoin transaction hash',
    });
  });

  it('detects ethereum hashes', () => {
    const result = detectChainFromTxHash(
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );

    expect(result).toEqual({
      chain: 'ethereum',
      ethereumAsset: 'native',
      label: 'Ethereum transaction hash',
    });
  });

  it('detects solana signatures', () => {
    const result = detectChainFromTxHash(
      '5JrFL9NNVNLV1PvnUbDd9BBCFZBgYACJSZHrKabKd21WR6DppEepK68CNFrM3Hi8FGHeKBXpGVVkUKeQhuvMXGJ1'
    );

    expect(result).toEqual({
      chain: 'solana',
      ethereumAsset: 'native',
      label: 'Solana transaction signature',
    });
  });

  it('returns null for unrecognized input', () => {
    expect(detectChainFromTxHash('not-a-hash')).toBeNull();
  });

  it('validates hashes against selected chain', () => {
    const btcHash = 'a'.repeat(64);
    const ethHash = `0x${'b'.repeat(64)}`;
    const solSig = '1111111111111111111111111111111111111111111111111111111111111111';

    expect(isValidTxHashForChain(btcHash, 'bitcoin')).toBe(true);
    expect(isValidTxHashForChain(ethHash, 'ethereum')).toBe(true);
    expect(isValidTxHashForChain(solSig, 'solana')).toBe(true);

    expect(isValidTxHashForChain(ethHash, 'bitcoin')).toBe(false);
    expect(isValidTxHashForChain(btcHash, 'ethereum')).toBe(false);
  });
});

