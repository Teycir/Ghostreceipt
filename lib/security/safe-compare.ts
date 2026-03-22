import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison for fixed-format hex identifiers.
 */
export function safeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  try {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}
