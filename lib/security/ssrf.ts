import { isIP } from 'node:net';

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
];
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local'];

const PRIVATE_IP_RANGES = [
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
  /^127\./,
  /^169\.254\./,
];

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

function stripIpv6Brackets(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

function isPrivateIpv6(ipv6: string): boolean {
  const normalized = ipv6.trim().toLowerCase();
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:0' ||
    normalized === '0:0:0:0:0:0:0:1'
  ) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    return true;
  }

  const firstHextetToken = normalized.split(':')[0] ?? '';
  if (!firstHextetToken) {
    return false;
  }

  const firstHextet = Number.parseInt(firstHextetToken, 16);
  if (!Number.isFinite(firstHextet) || firstHextet < 0 || firstHextet > 0xffff) {
    return false;
  }

  // Unique local addresses fc00::/7 (fc00 + fd00).
  if ((firstHextet & 0xfe00) === 0xfc00) {
    return true;
  }

  // Link-local addresses fe80::/10.
  if ((firstHextet & 0xffc0) === 0xfe80) {
    return true;
  }

  // Site-local addresses fec0::/10 (deprecated but still non-public).
  if ((firstHextet & 0xffc0) === 0xfec0) {
    return true;
  }

  return false;
}

function isObfuscatedIpLiteral(hostname: string): boolean {
  if (/^\d+$/.test(hostname)) {
    return true; // Dword-encoded IPv4 (e.g., 2130706433)
  }

  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    return true; // Hex-encoded IPv4 integer
  }

  if (hostname !== '0' && /^0[0-7]+$/.test(hostname)) {
    return true; // Octal-encoded IPv4 integer
  }

  const parts = hostname.split('.');
  if (parts.length === 4) {
    const hasObfuscatedPart = parts.some(
      (part) => /^0x[0-9a-f]+$/i.test(part) || (part.length > 1 && /^0[0-7]+$/.test(part))
    );
    const allPartsNumericLike = parts.every(
      (part) => /^\d+$/.test(part) || /^0x[0-9a-f]+$/i.test(part)
    );

    if (hasObfuscatedPart && allPartsNumericLike) {
      return true; // Mixed/obfuscated dotted IPv4 segments (hex/octal forms)
    }
  }

  if (/^(0x[0-9a-f]+)(\.0x[0-9a-f]+){1,3}$/i.test(hostname)) {
    return true; // Fully hex-encoded dotted IPv4
  }

  if (/^(0[0-7]+)(\.0[0-7]+){1,3}$/.test(hostname)) {
    return true; // Fully octal-encoded dotted IPv4
  }

  if (/^::ffff:/i.test(hostname)) {
    return true; // IPv4-mapped IPv6 literal
  }

  return false;
}

export function isPrivateOrLocalhost(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedWithoutBrackets = stripIpv6Brackets(normalizedHostname);

  if (
    BLOCKED_HOSTS.includes(normalizedHostname) ||
    BLOCKED_HOSTS.includes(normalizedWithoutBrackets)
  ) {
    return true;
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix))) {
    return true;
  }

  if (isObfuscatedIpLiteral(normalizedWithoutBrackets)) {
    return true;
  }

  // Use canonical IP parser first to reject valid non-public literals.
  const ipType = isIP(normalizedWithoutBrackets);
  if (ipType !== 0) {
    if (ipType === 4 && PRIVATE_IP_RANGES.some((range) => range.test(normalizedWithoutBrackets))) {
      return true;
    }

    if (ipType === 6 && isPrivateIpv6(normalizedWithoutBrackets)) {
      return true;
    }
  }

  for (const range of PRIVATE_IP_RANGES) {
    if (range.test(normalizedWithoutBrackets)) {
      return true;
    }
  }

  return false;
}

export function validateUrl(url: string, allowedProtocols: string[] = ['https']): {
  valid: boolean;
  error?: string;
} {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!allowedProtocols.includes(parsed.protocol.replace(':', ''))) {
    return {
      valid: false,
      error: `Protocol ${parsed.protocol} not allowed. Allowed: ${allowedProtocols.join(', ')}`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'Username/password in URLs is not allowed',
    };
  }

  if (isPrivateOrLocalhost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Access to private or localhost addresses is not allowed',
    };
  }

  return { valid: true };
}
