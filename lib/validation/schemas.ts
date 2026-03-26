import { z } from 'zod';

/**
 * Supported blockchain networks
 */
export const ChainSchema = z.enum(['bitcoin', 'ethereum', 'solana']);
export type Chain = z.infer<typeof ChainSchema>;

export const EthereumAssetSchema = z.enum(['native', 'usdc']);
export type EthereumAsset = z.infer<typeof EthereumAssetSchema>;

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
 * Solana transaction signature validation (base58)
 * Typical signatures are 64-88 chars and must avoid non-base58 characters.
 */
export const SolanaTxHashSchema = z
  .string()
  .min(64)
  .max(88)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Solana transaction signature');

/**
 * Oracle fetch transaction request
 */
export const OracleFetchTxRequestSchema = z.object({
  chain: ChainSchema,
  txHash: z.string().min(1, 'Transaction hash is required'),
  ethereumAsset: EthereumAssetSchema.optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Idempotency key must be at least 8 characters')
    .max(128, 'Idempotency key must be at most 128 characters')
    .regex(/^[A-Za-z0-9._:-]+$/, 'Idempotency key contains invalid characters')
    .optional(),
}).superRefine((data, ctx) => {
  if (data.chain !== 'ethereum' && data.ethereumAsset && data.ethereumAsset !== 'native') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ethereumAsset'],
      message: 'Ethereum asset selector is only supported for Ethereum requests',
    });
  }

  if (data.chain === 'bitcoin') {
    const parsed = BitcoinTxHashSchema.safeParse(data.txHash);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['txHash'],
        message: 'Invalid Bitcoin transaction hash',
      });
    }
  }

  if (data.chain === 'ethereum') {
    const parsed = EthereumTxHashSchema.safeParse(data.txHash);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['txHash'],
        message: 'Invalid Ethereum transaction hash',
      });
    }
  }

  if (data.chain === 'solana') {
    const parsed = SolanaTxHashSchema.safeParse(data.txHash);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['txHash'],
        message: 'Invalid Solana transaction signature',
      });
    }
  }
});

export type OracleFetchTxRequest = z.infer<typeof OracleFetchTxRequestSchema>;

/**
 * Share pointer request schemas for compact verification URLs.
 */
export const SharePointerIdSchema = z
  .string()
  .regex(/^r_[A-Za-z0-9_-]{16}$/u, 'Invalid share pointer id');

export const SharePointerCreateRequestSchema = z
  .object({
    proof: z.string().trim().min(1, 'Proof payload is required').max(100_000, 'Proof payload is too large'),
  })
  .strict();

export type SharePointerCreateRequest = z.infer<typeof SharePointerCreateRequestSchema>;

export const SharePointerResolveRequestSchema = z
  .object({
    id: SharePointerIdSchema,
  })
  .strict();

export type SharePointerResolveRequest = z.infer<typeof SharePointerResolveRequestSchema>;

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

export const OracleCommitmentSchema = z
  .string()
  .regex(/^[0-9]{1,78}$/, 'Invalid oracle commitment format');

export const OracleSignatureHexSchema = z
  .string()
  .regex(/^[a-f0-9]{128}$/i, 'Invalid oracle signature format');

export const OraclePubKeyIdSchema = z
  .string()
  .regex(/^[a-f0-9]{16}$/i, 'Invalid oracle public key id format');

export const OracleNonceSchema = z
  .string()
  .regex(/^[a-f0-9]{32,128}$/i, 'Invalid oracle nonce format');

export const OracleNullifierSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, 'Invalid oracle nullifier format');

export const OracleValidationStatusSchema = z.enum([
  'consensus_verified',
  'single_source_fallback',
  'single_source_only',
]);

/**
 * Oracle signed payload
 * Signature is bound to the full auth envelope (messageHash + nonce + timestamps + key id).
 */
export const OraclePayloadSchema = CanonicalTxDataSchema.extend({
  messageHash: OracleCommitmentSchema,
  nullifier: OracleNullifierSchema,
  oracleSignature: OracleSignatureHexSchema,
  oraclePubKeyId: OraclePubKeyIdSchema,
  oracleValidationStatus: OracleValidationStatusSchema.optional(),
  oracleValidationLabel: z.string().min(1).max(200).optional(),
  nonce: OracleNonceSchema,
  signedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
}).strict().superRefine((data, ctx) => {
  if (data.expiresAt <= data.signedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'expiresAt must be greater than signedAt',
    });
  }
});

export type OraclePayload = z.infer<typeof OraclePayloadSchema>;

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
  'TRANSACTION_REVERTED',
  'INSUFFICIENT_CONFIRMATIONS',
  'REPLAY_DETECTED',
  'NULLIFIER_CONFLICT',
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
  data: OraclePayloadSchema,
  cached: z.boolean().optional(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
