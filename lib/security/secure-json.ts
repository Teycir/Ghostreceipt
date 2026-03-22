import { NextRequest } from 'next/server';

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

function isDangerousKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function validateParsedJsonShape(
  parsed: unknown,
  maxDepth: number,
  maxNodes: number
): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const { value, depth } = current;
    if (value === null || typeof value !== 'object') {
      continue;
    }

    if (depth > maxDepth) {
      throw new Error(`JSON nesting too deep (max depth: ${maxDepth})`);
    }

    visitedNodes += 1;
    if (visitedNodes > maxNodes) {
      throw new Error(`JSON object too complex (max nodes: ${maxNodes})`);
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push({ value: item, depth: depth + 1 });
      }
      continue;
    }

    for (const [key, entryValue] of Object.entries(value)) {
      if (isDangerousKey(key)) {
        throw new Error('Potentially malicious JSON structure detected');
      }

      stack.push({ value: entryValue, depth: depth + 1 });
    }
  }
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
  
  const textByteLength = Buffer.byteLength(text, 'utf8');
  if (textByteLength > maxSize) {
    throw new Error(`Payload too large: ${textByteLength} bytes (max: ${maxSize})`);
  }

  if (textByteLength === 0) {
    throw new Error('Empty request body');
  }

  // Parse JSON safely
  try {
    const parsed = JSON.parse(text);
    validateParsedJsonShape(parsed, maxDepth, maxNodes);

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON syntax');
    }
    throw error;
  }
}
