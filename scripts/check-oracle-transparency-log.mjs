#!/usr/bin/env node

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const HEX_64_RE = /^[a-f0-9]{64}$/i;
const HEX_16_RE = /^[a-f0-9]{16}$/i;
const VALID_STATUSES = new Set(['active', 'retired', 'revoked']);

function hashEntry(entry) {
  return createHash('sha256')
    .update(
      [
        `index=${entry.index}`,
        `keyId=${entry.keyId}`,
        `publicKey=${entry.publicKey}`,
        `validFrom=${entry.validFrom}`,
        `validUntil=${entry.validUntil === null ? 'null' : entry.validUntil}`,
        `status=${entry.status}`,
        `prevEntryHash=${entry.prevEntryHash === null ? 'null' : entry.prevEntryHash}`,
      ].join('&'),
      'utf8'
    )
    .digest('hex');
}

function keyIdFromPublicKey(publicKey) {
  return createHash('sha256')
    .update(Buffer.from(publicKey, 'hex'))
    .digest('hex')
    .slice(0, 16);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validate(log) {
  const errors = [];

  if (!log || typeof log !== 'object') {
    return ['Transparency log root must be an object'];
  }

  if (log.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }

  if (typeof log.generatedAt !== 'string') {
    errors.push('generatedAt must be an ISO date string');
  } else if (Number.isNaN(Date.parse(log.generatedAt))) {
    errors.push('generatedAt is not a valid datetime');
  }

  if (!Array.isArray(log.entries) || log.entries.length === 0) {
    errors.push('entries must be a non-empty array');
    return errors;
  }

  let previousHash = null;
  for (let i = 0; i < log.entries.length; i++) {
    const entry = log.entries[i];
    const prefix = `entries[${i}]`;

    if (!entry || typeof entry !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (entry.index !== i) {
      errors.push(`${prefix}.index must equal ${i}`);
    }

    if (typeof entry.keyId !== 'string' || !HEX_16_RE.test(entry.keyId)) {
      errors.push(`${prefix}.keyId must be 16 hex chars`);
    }

    if (typeof entry.publicKey !== 'string' || !HEX_64_RE.test(entry.publicKey)) {
      errors.push(`${prefix}.publicKey must be 64 hex chars`);
    }

    if (!isPositiveInteger(entry.validFrom)) {
      errors.push(`${prefix}.validFrom must be a positive integer`);
    }

    if (entry.validUntil !== null && !isPositiveInteger(entry.validUntil)) {
      errors.push(`${prefix}.validUntil must be null or a positive integer`);
    }

    if (entry.validUntil !== null && entry.validUntil <= entry.validFrom) {
      errors.push(`${prefix}.validUntil must be greater than validFrom`);
    }

    if (!VALID_STATUSES.has(entry.status)) {
      errors.push(`${prefix}.status must be one of: active, retired, revoked`);
    } else if (entry.status === 'active' && entry.validUntil !== null) {
      errors.push(`${prefix}.active entries must set validUntil to null`);
    } else if (entry.status !== 'active' && entry.validUntil === null) {
      errors.push(`${prefix}.retired/revoked entries must set validUntil`);
    }

    if (entry.prevEntryHash !== previousHash) {
      errors.push(`${prefix}.prevEntryHash chain mismatch`);
    }

    if (typeof entry.entryHash !== 'string' || !HEX_64_RE.test(entry.entryHash)) {
      errors.push(`${prefix}.entryHash must be 64 hex chars`);
    } else {
      const expectedHash = hashEntry({
        index: entry.index,
        keyId: entry.keyId,
        prevEntryHash: entry.prevEntryHash,
        publicKey: entry.publicKey,
        status: entry.status,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil,
      });
      if (expectedHash.toLowerCase() !== entry.entryHash.toLowerCase()) {
        errors.push(`${prefix}.entryHash does not match computed hash`);
      }
    }

    if (typeof entry.publicKey === 'string' && HEX_64_RE.test(entry.publicKey)) {
      const expectedKeyId = keyIdFromPublicKey(entry.publicKey);
      if (entry.keyId?.toLowerCase() !== expectedKeyId.toLowerCase()) {
        errors.push(`${prefix}.keyId does not match derived public key id`);
      }
    }

    previousHash = entry.entryHash ?? previousHash;
  }

  return errors;
}

const inputPath = process.argv[2] ?? 'config/oracle/transparency-log.json';
const fullPath = resolve(process.cwd(), inputPath);

let raw;
try {
  raw = readFileSync(fullPath, 'utf8');
} catch (error) {
  console.error(`Failed to read transparency log at ${fullPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  console.error(`Invalid JSON in transparency log: ${fullPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = validate(parsed);
if (errors.length > 0) {
  console.error(`Transparency log validation failed for ${fullPath}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Transparency log OK (${fullPath})`);
