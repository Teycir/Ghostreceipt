const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function hasDangerousObjectKeys(value: unknown): boolean {
  const stack: unknown[] = [value];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === null || typeof current !== 'object') {
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }

    for (const [key, entryValue] of Object.entries(current)) {
      if (DANGEROUS_KEYS.has(key)) {
        return true;
      }
      stack.push(entryValue);
    }
  }

  return false;
}

export function encodeSharePayload(jsonPayload: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(jsonPayload, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/u, '');
  }

  const bytes = new TextEncoder().encode(jsonPayload);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function decodeSharePayload(encodedPayload: string): string {
  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = `${base64}${padding}`;

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64').toString('utf8');
  }

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
