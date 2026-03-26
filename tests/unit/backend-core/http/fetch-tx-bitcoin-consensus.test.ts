import { resetCachedOracleSignerForTests } from '@/lib/libraries/backend';
import {
  __resetFetchTxCanonicalCacheForTests,
  fetchAndSignOracleTransaction,
} from '@/lib/libraries/backend-core/http/fetch-tx';
import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { HeliusProvider } from '@/lib/providers/solana/helius';
import { SolanaPublicRpcProvider } from '@/lib/providers/solana/public-rpc';

describe('oracle consensus gating and labeling', () => {
  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];

  beforeEach(() => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
  });

  afterEach(() => {
    if (originalOraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalOraclePrivateKey;
    }

    __resetFetchTxCanonicalCacheForTests();
    resetCachedOracleSignerForTests();
    jest.restoreAllMocks();
  });

  function buildCanonicalBitcoinTx(txHash: string, valueAtomic = '1000') {
    return {
      chain: 'bitcoin' as const,
      txHash,
      valueAtomic,
      timestampUnix: 1700000000,
      confirmations: 12,
      blockNumber: 123456,
      blockHash: 'b'.repeat(64),
    };
  }

  function buildCanonicalEthereumTx(txHash: string, valueAtomic = '1000000000000000') {
    return {
      chain: 'ethereum' as const,
      txHash,
      valueAtomic,
      timestampUnix: 1700000000,
      confirmations: 22,
      blockNumber: 19876543,
      blockHash: 'c'.repeat(66),
    };
  }

  function buildCanonicalSolanaTx(txHash: string, valueAtomic = '2500000') {
    return {
      chain: 'solana' as const,
      txHash,
      valueAtomic,
      timestampUnix: 1700000000,
      confirmations: 4,
      blockNumber: 299887766,
      blockHash: '5'.repeat(44),
    };
  }

  it('requires both bitcoin providers to agree in strict mode before signing', async () => {
    const txHash = 'a'.repeat(64);
    const canonical = buildCanonicalBitcoinTx(txHash);
    const blockCypherSpy = jest
      .spyOn(BlockCypherProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(canonical);
    const mempoolSpy = jest
      .spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction')
      .mockResolvedValue({
        ...canonical,
        confirmations: 9,
      });

    const result = await fetchAndSignOracleTransaction(
      'bitcoin',
      txHash,
      {
        bitcoinConsensusMode: 'strict',
        nonceHex: 'c'.repeat(32),
        nowMs: 1700000000000,
      }
    );

    expect(result.data.chain).toBe('bitcoin');
    expect(result.data.messageHash).toMatch(/^[0-9]{1,78}$/);
    expect(result.data.oracleValidationStatus).toBe('consensus_verified');
    expect(result.data.oracleValidationLabel).toContain('Dual-source consensus verified');
    expect(blockCypherSpy).toHaveBeenCalledTimes(1);
    expect(mempoolSpy).toHaveBeenCalledTimes(1);
  });

  it('fails closed when providers disagree on canonical value', async () => {
    const txHash = 'd'.repeat(64);
    jest
      .spyOn(BlockCypherProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(buildCanonicalBitcoinTx(txHash, '1000'));
    jest
      .spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(buildCanonicalBitcoinTx(txHash, '999'));

    await expect(
      fetchAndSignOracleTransaction('bitcoin', txHash, {
        bitcoinConsensusMode: 'best_effort',
      })
    ).rejects.toThrow('Bitcoin consensus mismatch');
  });

  it('falls back to single-source in best-effort mode when verification provider is unavailable', async () => {
    const txHash = 'e'.repeat(64);
    jest
      .spyOn(BlockCypherProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(buildCanonicalBitcoinTx(txHash));
    jest
      .spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction')
      .mockRejectedValue(new Error('Provider timeout'));

    const result = await fetchAndSignOracleTransaction('bitcoin', txHash, {
      bitcoinConsensusMode: 'best_effort',
    });

    expect(result.data.oracleValidationStatus).toBe('single_source_fallback');
    expect(result.data.oracleValidationLabel).toContain('Single-source fallback');
  });

  it('skips peer-consensus verification when mode is off', async () => {
    const txHash = 'f'.repeat(64);
    const blockCypherSpy = jest
      .spyOn(BlockCypherProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(buildCanonicalBitcoinTx(txHash));
    const mempoolSpy = jest.spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction');

    const result = await fetchAndSignOracleTransaction(
      'bitcoin',
      txHash,
      { bitcoinConsensusMode: 'off' }
    );

    expect(result.data.chain).toBe('bitcoin');
    expect(result.data.oracleValidationStatus).toBe('single_source_only');
    expect(result.data.oracleValidationLabel).toContain('Single-source validation');
    expect(blockCypherSpy).toHaveBeenCalledTimes(1);
    expect(mempoolSpy).not.toHaveBeenCalled();
  });

  it('applies ethereum public-source consensus in best-effort mode', async () => {
    const txHash = `0x${'1'.repeat(64)}`;
    const canonical = buildCanonicalEthereumTx(txHash);
    const etherscanSpy = jest
      .spyOn(EtherscanProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(canonical);
    const publicRpcSpy = jest
      .spyOn(EthereumPublicRpcProvider.prototype, 'fetchTransaction')
      .mockResolvedValue({
        ...canonical,
        confirmations: 18,
      });

    const result = await fetchAndSignOracleTransaction('ethereum', txHash, {
      ethereumConsensusMode: 'best_effort',
      etherscanKeys: ['etherscan-test-key'],
      ethereumAsset: 'native',
    });

    expect(result.data.oracleValidationStatus).toBe('consensus_verified');
    expect(result.data.oracleValidationLabel).toContain('Dual-source consensus verified');
    expect(etherscanSpy).toHaveBeenCalledTimes(1);
    expect(publicRpcSpy).toHaveBeenCalledTimes(1);
  });

  it('applies solana best-effort fallback when public consensus source is unavailable', async () => {
    const txHash = '5j7s9f6q2c1k8r4d3m2n1p9z8x7w6v5u4t3s2r1q9p8m7n6b5v4c3x2z1q9w8e7r';
    jest
      .spyOn(HeliusProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(buildCanonicalSolanaTx(txHash));
    jest
      .spyOn(SolanaPublicRpcProvider.prototype, 'fetchTransaction')
      .mockRejectedValue(new Error('RPC timeout'));

    const result = await fetchAndSignOracleTransaction('solana', txHash, {
      solanaConsensusMode: 'best_effort',
      heliusKeys: ['helius-test-key'],
    });

    expect(result.data.oracleValidationStatus).toBe('single_source_fallback');
    expect(result.data.oracleValidationLabel).toContain('Single-source fallback');
  });

  it('caps auth signature lifetime to configured maximum', async () => {
    const txHash = '9'.repeat(64);
    jest
      .spyOn(BlockCypherProvider.prototype, 'fetchTransaction')
      .mockResolvedValue(buildCanonicalBitcoinTx(txHash));

    const result = await fetchAndSignOracleTransaction('bitcoin', txHash, {
      authTtlSeconds: 3600,
      bitcoinConsensusMode: 'off',
      maxAuthTtlSeconds: 120,
      nowMs: 1700000000000,
      nonceHex: 'a'.repeat(32),
    });

    expect(result.data.expiresAt - result.data.signedAt).toBe(120);
  });
});
