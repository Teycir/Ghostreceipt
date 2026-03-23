import { createHash } from 'crypto';
import { OracleSigner } from '@/lib/oracle/signer';

interface OracleSignerCacheEntry {
  privateKeyFingerprint: string;
  signer: OracleSigner;
}

let oracleSignerCache: OracleSignerCacheEntry | null = null;

function fingerprintPrivateKey(privateKey: string): string {
  return createHash('sha256').update(privateKey).digest('hex');
}

interface CachedSignerOptions {
  envKey?: string;
  missingKeyMessage?: string;
}

export function getCachedOracleSignerFromEnv({
  envKey = 'ORACLE_PRIVATE_KEY',
  missingKeyMessage = 'Oracle private key not configured',
}: CachedSignerOptions = {}): OracleSigner {
  const oraclePrivateKey = process.env[envKey];
  if (!oraclePrivateKey) {
    throw new Error(missingKeyMessage);
  }

  const privateKeyFingerprint = fingerprintPrivateKey(oraclePrivateKey);
  if (
    oracleSignerCache === null ||
    oracleSignerCache.privateKeyFingerprint !== privateKeyFingerprint
  ) {
    oracleSignerCache = {
      privateKeyFingerprint,
      signer: new OracleSigner(oraclePrivateKey),
    };
  }

  return oracleSignerCache.signer;
}

export function resetCachedOracleSignerForTests(): void {
  oracleSignerCache = null;
}
