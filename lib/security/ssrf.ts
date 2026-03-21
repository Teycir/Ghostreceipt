const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
];

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^fc00:/,
  /^fe80:/,
];

export function isPrivateOrLocalhost(hostname: string): boolean {
  if (BLOCKED_HOSTS.includes(hostname.toLowerCase())) {
    return true;
  }

  for (const range of PRIVATE_IP_RANGES) {
    if (range.test(hostname)) {
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

  if (isPrivateOrLocalhost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Access to private or localhost addresses is not allowed',
    };
  }

  return { valid: true };
}
