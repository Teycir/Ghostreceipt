import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import type { CanonicalTxData } from '@/lib/validation/schemas';

describe('computeOracleCommitment', () => {
  const baseData: CanonicalTxData = {
    chain: 'bitcoin',
    txHash: 'a'.repeat(64),
    valueAtomic: '100000000',
    timestampUnix: 1700000000,
    confirmations: 12,
    blockNumber: 123,
    blockHash: 'b'.repeat(64),
  };

  it('is deterministic for identical input', async () => {
    const first = await computeOracleCommitment(baseData);
    const second = await computeOracleCommitment(baseData);

    expect(first).toBe(second);
  });

  it('changes when chain changes', async () => {
    const bitcoinCommitment = await computeOracleCommitment(baseData);
    const ethereumCommitment = await computeOracleCommitment({
      ...baseData,
      chain: 'ethereum',
      txHash: `0x${baseData.txHash}`,
    });

    expect(bitcoinCommitment).not.toBe(ethereumCommitment);
  });
});
