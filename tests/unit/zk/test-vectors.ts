import type { ReceiptWitness } from '@/lib/zk/witness';

/**
 * Test vectors for circuit validation
 */

/**
 * Valid test vector - should pass all constraints
 */
export const validVector: ReceiptWitness = {
  // Public inputs
  claimedAmount: '1000000000000000000', // 1 ETH
  minDate: '1234567890',
  oracleCommitment: '3149642683',
  
  // Private inputs
  realValue: '2000000000000000000', // 2 ETH (more than claimed)
  realTimestamp: '1234567900', // After minDate
  txHash: [
    '2863311530', // 0xaaaaaaaa
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
  ],
  chainId: '1',
};

/**
 * Invalid vector - claimedAmount > realValue
 */
export const invalidValueVector: ReceiptWitness = {
  claimedAmount: '3000000000000000000', // 3 ETH (more than real)
  minDate: '1234567890',
  oracleCommitment: '3149642683',
  realValue: '2000000000000000000', // 2 ETH
  realTimestamp: '1234567900',
  txHash: [
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
  ],
  chainId: '1',
};

/**
 * Invalid vector - minDate > realTimestamp
 */
export const invalidTimestampVector: ReceiptWitness = {
  claimedAmount: '1000000000000000000',
  minDate: '1234567900', // After real timestamp
  oracleCommitment: '3149642683',
  realValue: '2000000000000000000',
  realTimestamp: '1234567890', // Before minDate
  txHash: [
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
  ],
  chainId: '1',
};

/**
 * Invalid vector - zero commitment
 */
export const invalidSignatureVector: ReceiptWitness = {
  claimedAmount: '1000000000000000000',
  minDate: '1234567890',
  oracleCommitment: '0',
  realValue: '2000000000000000000',
  realTimestamp: '1234567900',
  txHash: [
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
  ],
  chainId: '1',
};

/**
 * Edge case - exact match (claimedAmount === realValue)
 */
export const exactMatchVector: ReceiptWitness = {
  claimedAmount: '1000000000000000000',
  minDate: '1234567890',
  oracleCommitment: '3149642683',
  realValue: '1000000000000000000', // Exact match
  realTimestamp: '1234567890', // Exact match
  txHash: [
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
  ],
  chainId: '1',
};

/**
 * Bitcoin test vector (satoshis)
 */
export const bitcoinVector: ReceiptWitness = {
  claimedAmount: '100000000', // 1 BTC in satoshis
  minDate: '1234567890',
  oracleCommitment: '3149642683',
  realValue: '200000000', // 2 BTC
  realTimestamp: '1234567900',
  txHash: [
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
    '2863311530',
  ],
  chainId: '0',
};
