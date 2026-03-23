import { createHash } from 'crypto';
import { z } from 'zod';
import transparencyLogArtifact from '@/config/oracle/transparency-log.json';
import { OracleSigner } from '@/lib/oracle/signer';
import { safeHexEqual } from '@/lib/security/safe-compare';
import { OraclePubKeyIdSchema } from '@/lib/validation/schemas';

export const OracleTransparencyStatusSchema = z.enum([
  'active',
  'retired',
  'revoked',
]);

export const OracleTransparencyEntrySchema = z.object({
  entryHash: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid entry hash format'),
  index: z.number().int().nonnegative(),
  keyId: OraclePubKeyIdSchema,
  prevEntryHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  publicKey: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid public key format'),
  status: OracleTransparencyStatusSchema,
  validFrom: z.number().int().positive(),
  validUntil: z.number().int().positive().nullable(),
}).strict().superRefine((entry, ctx) => {
  if (entry.validUntil !== null && entry.validUntil <= entry.validFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validUntil'],
      message: 'validUntil must be greater than validFrom when provided',
    });
  }

  if (entry.status === 'active' && entry.validUntil !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validUntil'],
      message: 'active keys must keep validUntil = null',
    });
  }

  if (entry.status !== 'active' && entry.validUntil === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validUntil'],
      message: 'retired/revoked keys must set validUntil',
    });
  }
});

export const OracleTransparencyLogSchema = z.object({
  entries: z.array(OracleTransparencyEntrySchema).min(1),
  generatedAt: z.string().datetime(),
  schemaVersion: z.literal(1),
}).strict();

export type OracleTransparencyStatus = z.infer<typeof OracleTransparencyStatusSchema>;
export type OracleTransparencyEntry = z.infer<typeof OracleTransparencyEntrySchema>;
export type OracleTransparencyLog = z.infer<typeof OracleTransparencyLogSchema>;

export type OracleTransparencyRejectReason =
  | 'LOG_INVALID'
  | 'KEY_UNKNOWN'
  | 'KEY_NOT_YET_VALID'
  | 'KEY_EXPIRED'
  | 'KEY_REVOKED';

export type OracleTransparencyDecision =
  | {
      entry: OracleTransparencyEntry;
      valid: true;
    }
  | {
      message: string;
      reason: OracleTransparencyRejectReason;
      valid: false;
    };

let cachedLog: OracleTransparencyLog | null = null;
let cachedError: string | null = null;
let testLogOverride: unknown | null = null;

function serializeEntryForHash(
  entry: Omit<OracleTransparencyEntry, 'entryHash'>
): string {
  return [
    `index=${entry.index}`,
    `keyId=${entry.keyId}`,
    `publicKey=${entry.publicKey}`,
    `validFrom=${entry.validFrom}`,
    `validUntil=${entry.validUntil === null ? 'null' : entry.validUntil}`,
    `status=${entry.status}`,
    `prevEntryHash=${entry.prevEntryHash === null ? 'null' : entry.prevEntryHash}`,
  ].join('&');
}

function computeEntryHash(entry: Omit<OracleTransparencyEntry, 'entryHash'>): string {
  return createHash('sha256')
    .update(serializeEntryForHash(entry), 'utf8')
    .digest('hex');
}

function validateHashChain(log: OracleTransparencyLog): string | null {
  let previousHash: string | null = null;
  for (const [i, entry] of log.entries.entries()) {
    if (entry.index !== i) {
      return `Transparency log entry index mismatch at position ${i}`;
    }

    if (entry.prevEntryHash !== previousHash) {
      return `Transparency log chain mismatch at entry index ${entry.index}`;
    }

    const derivedKeyId = OracleSigner.derivePublicKeyIdFromHex(entry.publicKey);
    if (!safeHexEqual(derivedKeyId, entry.keyId)) {
      return `Transparency log keyId mismatch at entry index ${entry.index}`;
    }

    const expectedHash = computeEntryHash({
      index: entry.index,
      keyId: entry.keyId,
      prevEntryHash: entry.prevEntryHash,
      publicKey: entry.publicKey,
      status: entry.status,
      validFrom: entry.validFrom,
      validUntil: entry.validUntil,
    });
    if (!safeHexEqual(expectedHash, entry.entryHash)) {
      return `Transparency log entry hash mismatch at entry index ${entry.index}`;
    }

    previousHash = entry.entryHash;
  }

  return null;
}

function parseTransparencyLog(rawLog: unknown): OracleTransparencyLog {
  const parsed = OracleTransparencyLogSchema.safeParse(rawLog);
  if (!parsed.success) {
    throw new Error('Transparency log JSON schema validation failed');
  }

  const chainError = validateHashChain(parsed.data);
  if (chainError) {
    throw new Error(chainError);
  }

  return parsed.data;
}

export function getOracleTransparencyLog(): OracleTransparencyLog {
  if (cachedLog) {
    return cachedLog;
  }

  if (cachedError) {
    throw new Error(cachedError);
  }

  try {
    const raw = testLogOverride ?? transparencyLogArtifact;
    cachedLog = parseTransparencyLog(raw);
    return cachedLog;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown transparency log parse error';
    cachedError = message;
    throw new Error(message);
  }
}

function pickMatchingKeyWindow(
  entries: OracleTransparencyEntry[],
  signedAt: number
): OracleTransparencyEntry | null {
  for (const entry of entries) {
    const startsBefore = signedAt >= entry.validFrom;
    const endsAfter = entry.validUntil === null || signedAt < entry.validUntil;
    if (startsBefore && endsAfter) {
      return entry;
    }
  }
  return null;
}

export function checkOracleKeyTransparencyValidity(input: {
  keyId: string;
  signedAt: number;
}): OracleTransparencyDecision {
  let log: OracleTransparencyLog;
  try {
    log = getOracleTransparencyLog();
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `Transparency log invalid: ${error.message}`
          : 'Transparency log invalid',
      reason: 'LOG_INVALID',
      valid: false,
    };
  }

  const keyEntries = log.entries
    .filter((entry) => safeHexEqual(entry.keyId, input.keyId))
    .sort((a, b) => a.validFrom - b.validFrom);

  if (keyEntries.length === 0) {
    return {
      message: 'Oracle key is not present in transparency log',
      reason: 'KEY_UNKNOWN',
      valid: false,
    };
  }

  const matched = pickMatchingKeyWindow(keyEntries, input.signedAt);
  if (!matched) {
    const earliestStart = keyEntries[0]?.validFrom;
    if (earliestStart !== undefined && input.signedAt < earliestStart) {
      return {
        message: 'Oracle key was not active yet at signedAt',
        reason: 'KEY_NOT_YET_VALID',
        valid: false,
      };
    }

    return {
      message: 'Oracle key was not valid at signedAt',
      reason: 'KEY_EXPIRED',
      valid: false,
    };
  }

  if (matched.status === 'revoked') {
    return {
      message: 'Oracle key is revoked for this signing window',
      reason: 'KEY_REVOKED',
      valid: false,
    };
  }

  return {
    entry: matched,
    valid: true,
  };
}

export function __resetOracleTransparencyLogCacheForTests(): void {
  cachedLog = null;
  cachedError = null;
  testLogOverride = null;
}

export function __setOracleTransparencyLogForTests(log: unknown): void {
  testLogOverride = log;
  cachedLog = null;
  cachedError = null;
}

export function createOracleTransparencyEntryHash(
  entry: Omit<OracleTransparencyEntry, 'entryHash'>
): string {
  return computeEntryHash(entry);
}
