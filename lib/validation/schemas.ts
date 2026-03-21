import { z } from 'zod';

/**
 * Supported blockchain networks
 */
export const ChainSchema = z.enum(['bitcoin', 'ethereum']);
export type Chain = z.infer<typeof ChainSchema>;

/**
 * Bitcoin transaction hash validation
 * 64 hex characters
 */
export const BitcoinTxHashSchema = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]{64}$/i, 'Invalid Bitcoin transaction hash');

/**
 * Ethereum transaction hash validation
 * 0x prefix + 64 hex characters
 */
export const EthereumTxHashSchema = z
  .string()
  .length(66)
  .regex(/^0x[a-f0-9]{64}$/i, 'Invalid Ethereum transaction hash');

/**
 * Oracle fetch transaction request
 */
export const OracleFetchTxRequestSchema = z.object({
  chain: ChainSchema,
  txHash: z.string().min(1, 'Transaction hash is required'),
  idempotencyKey: z.string().optional(),
});

export type OracleFetchTxRequest = z.infer<typeof OracleFetchTxRequestSchema>;

/**
 * Canonical transaction data (normalized across chains)
 */
export const CanonicalTxDataSchema = z.object({
  chain: ChainSchema,
  txHash: z.string(),
  valueAtomic: z.string(), // BigInt as string to avoid precision loss
  timestampUnix: z.number().int().positive(),
  confirmations: z.number().int().nonnegative(),
  blockNumber: z.number().int().positive().optional(),
  blockHash: z.string().optional(),
});

export type CanonicalTxData = z.infer<typeof CanonicalTxDataSchema>;

/**
 * Oracle signed payload (v1)
 */
export const OraclePayloadV1Schema = CanonicalTxDataSchema.extend({
  messageHash: z.string(),
  oracleSignature: z.string(),
  oraclePubKeyId: z.string(),
  schemaVersion: z.literal('v1'),
  signedAt: z.number().int().positive(),
});

export type OraclePayloadV1 = z.infer<typeof OraclePayloadV1Schema>;

/**
 * Error codes for structured error handling
 */
export const ErrorCodeSchema = z.enum([
  'INVALID_HASH',
  'UNSUPPORTED_CHAIN',
  'PROVIDER_TIMEOUT',
  'PROVIDER_ERROR',
  'NORMALIZATION_ERROR',
  'SIGNING_ERROR',
  'RATE_LIMIT_EXCEEDED',
  'TRANSACTION_NOT_FOUND',
  'INSUFFICIENT_CONFIRMATIONS',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Structured error response
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Success response wrapper
 */
export const SuccessResponseSchema = z.object({
  data: OraclePayloadV1Schema,
  cached: z.boolean().optional(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
