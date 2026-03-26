export interface NullifierClaimInput {
  claimedAmount: string;
  minDateUnix: number;
}

export interface NullifierClaimDigestInput {
  claimDigest: string;
}

export interface NullifierStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClientNullifierCheckResult {
  valid: boolean;
  mode: 'conflict' | 'first_seen' | 'idempotent' | 'storage_unavailable';
  message?: string;
}

interface StoredNullifierClaim {
  claimDigest?: string;
  claimedAmount?: string;
  minDateUnix?: number;
}

const NULLIFIER_STORAGE_KEY = 'gr:verified-nullifiers';
const NULLIFIER_PREFIX = 'gr:nullifier:message-hash:';

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export async function deriveNullifierFromMessageHash(messageHash: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API unavailable');
  }

  const data = new TextEncoder().encode(`${NULLIFIER_PREFIX}${messageHash}`);
  const digest = await subtle.digest('SHA-256', data);
  return toHex(digest);
}

function claimsEqual(a: StoredNullifierClaim, b: NullifierClaimInput): boolean {
  return a.claimedAmount === b.claimedAmount && a.minDateUnix === b.minDateUnix;
}

function hasTupleClaim(value: StoredNullifierClaim | undefined): value is {
  claimedAmount: string;
  minDateUnix: number;
} {
  return (
    Boolean(value) &&
    typeof value?.claimedAmount === 'string' &&
    typeof value?.minDateUnix === 'number'
  );
}

function hasDigestClaim(value: StoredNullifierClaim | undefined): value is {
  claimDigest: string;
} {
  return Boolean(value) && typeof value?.claimDigest === 'string';
}

function parseStoredRegistry(raw: string | null): Record<string, StoredNullifierClaim> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, StoredNullifierClaim>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {};
    }
    throw error;
  }
}

export function checkClientNullifierConflict(
  input: {
    claim: NullifierClaimInput;
    nullifier: string;
  },
  storage: NullifierStorageLike | null
): ClientNullifierCheckResult {
  if (!storage) {
    return {
      valid: true,
      mode: 'storage_unavailable',
    };
  }

  try {
    const registry = parseStoredRegistry(storage.getItem(NULLIFIER_STORAGE_KEY));
    const existing = registry[input.nullifier];

    if (!existing) {
      registry[input.nullifier] = {
        claimedAmount: input.claim.claimedAmount,
        minDateUnix: input.claim.minDateUnix,
      };
      storage.setItem(NULLIFIER_STORAGE_KEY, JSON.stringify(registry));
      return {
        valid: true,
        mode: 'first_seen',
      };
    }

    if (hasTupleClaim(existing) && claimsEqual(existing, input.claim)) {
      return {
        valid: true,
        mode: 'idempotent',
      };
    }

    return {
      valid: false,
      mode: 'conflict',
      message: 'Nullifier conflict detected: this transaction was already used for a different claim.',
    };
  } catch (error) {
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('storage'))) {
      return {
        valid: true,
        mode: 'storage_unavailable',
      };
    }
    throw error;
  }
}

export function checkClientNullifierConflictByDigest(
  input: {
    claim: NullifierClaimDigestInput;
    nullifier: string;
  },
  storage: NullifierStorageLike | null
): ClientNullifierCheckResult {
  if (!storage) {
    return {
      valid: true,
      mode: 'storage_unavailable',
    };
  }

  const claimDigest = input.claim.claimDigest.trim();
  if (!claimDigest) {
    return {
      valid: false,
      mode: 'conflict',
      message: 'Nullifier conflict detected: missing claim digest.',
    };
  }

  try {
    const registry = parseStoredRegistry(storage.getItem(NULLIFIER_STORAGE_KEY));
    const existing = registry[input.nullifier];

    if (!existing) {
      registry[input.nullifier] = {
        claimDigest,
      };
      storage.setItem(NULLIFIER_STORAGE_KEY, JSON.stringify(registry));
      return {
        valid: true,
        mode: 'first_seen',
      };
    }

    if (hasDigestClaim(existing) && existing.claimDigest === claimDigest) {
      return {
        valid: true,
        mode: 'idempotent',
      };
    }

    return {
      valid: false,
      mode: 'conflict',
      message: 'Nullifier conflict detected: this transaction was already used for a different claim.',
    };
  } catch (error) {
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('storage'))) {
      return {
        valid: true,
        mode: 'storage_unavailable',
      };
    }
    throw error;
  }
}
