import { NextRequest } from 'next/server';

/**
 * Secure JSON parsing configuration
 */
export interface SecureJsonOptions {
  maxSize?: number; // Maximum payload size in bytes
  allowedContentTypes?: string[];
}

const DEFAULT_MAX_SIZE = 1024 * 100; // 100KB
const DEFAULT_ALLOWED_CONTENT_TYPES = ['application/json', 'text/plain'];

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

  // Validate Content-Type
  const contentType = request.headers.get('content-type');
  if (contentType) {
    const normalizedType = contentType.split(';')[0].trim().toLowerCase();
    if (!allowedContentTypes.includes(normalizedType)) {
      throw new Error(`Invalid Content-Type: ${contentType}`);
    }
  }

  // Check Content-Length if provided
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size) || size > maxSize) {
      throw new Error(`Payload too large: ${size} bytes (max: ${maxSize})`);
    }
  }

  // Read body with size limit
  const text = await request.text();
  
  if (text.length > maxSize) {
    throw new Error(`Payload too large: ${text.length} bytes (max: ${maxSize})`);
  }

  if (text.length === 0) {
    throw new Error('Empty request body');
  }

  // Parse JSON safely
  try {
    const parsed = JSON.parse(text);
    
    // Prevent prototype pollution
    if (parsed && typeof parsed === 'object') {
      if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
        throw new Error('Potentially malicious JSON structure detected');
      }
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON syntax');
    }
    throw error;
  }
}
