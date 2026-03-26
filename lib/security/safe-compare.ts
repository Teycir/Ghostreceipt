import { timingSafeEqual } from 'crypto';
import { secureError } from './secure-logging';

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
  } catch (error) {
    secureError('[safeHexEqual] Comparison failed:', error);
    if (error instanceof TypeError || error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}
