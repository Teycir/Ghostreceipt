import { NextRequest } from 'next/server';
import { sanitizeAndValidateJsonInput } from './json-input-sanitizer';

/**
 * Secure JSON parsing configuration
 */
export interface SecureJsonOptions {
  maxSize?: number; // Maximum payload size in bytes
  allowedContentTypes?: string[];
  maxDepth?: number;
  maxNodes?: number;
}

const DEFAULT_MAX_SIZE = 1024 * 100; // 100KB
const DEFAULT_ALLOWED_CONTENT_TYPES = ['application/json', 'text/plain'];
const DEFAULT_MAX_DEPTH = 40;
const DEFAULT_MAX_NODES = 10000;

function getUtf8ByteLength(value: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(value, 'utf8');
  }

  return new TextEncoder().encode(value).byteLength;
}

/**
 * Securely parse JSON from request with size limits and validation
 * 
 * Mitigates CWE-502 (Insecure Deserialization) by:
 * - Enforcing payload size limits
 * - Validating Content-Type headers
 * - Using safe JSON.parse (no prototype pollution)
 * - Proper error handling
 */
export async function parseSecureJson(
  request: NextRequest,
  options: SecureJsonOptions = {}
): Promise<unknown> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;

  // Validate Content-Type
  const contentType = request.headers.get('content-type');
  if (contentType) {
    const normalizedType = (contentType.split(';')[0] ?? '').trim().toLowerCase();
    if (!allowedContentTypes.includes(normalizedType)) {
      throw new Error(`Invalid Content-Type: ${contentType}`);
    }
  }

  // Check Content-Length if provided
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (!Number.isFinite(size) || size < 0 || size > maxSize) {
      throw new Error(`Payload too large: ${size} bytes (max: ${maxSize})`);
    }
  }

  // Read body with size limit
  const text = await request.text();
  
  const textByteLength = getUtf8ByteLength(text);
  if (textByteLength > maxSize) {
    throw new Error(`Payload too large: ${textByteLength} bytes (max: ${maxSize})`);
  }

  if (textByteLength === 0) {
    throw new Error('Empty request body');
  }

  // Parse JSON safely
  try {
    const parsed = JSON.parse(text);
    return sanitizeAndValidateJsonInput(parsed, {
      maxDepth,
      maxNodes,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON syntax');
    }
    throw error;
  }
}
