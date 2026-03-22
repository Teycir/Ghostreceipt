/**
 * Secure logging utilities to prevent CWE-117 log injection
 * 
 * Log injection occurs when untrusted user input is written to logs without
 * sanitization, allowing attackers to:
 * - Forge log entries by injecting newlines
 * - Break log parsing/monitoring tools
 * - Inject malicious content into log aggregation systems
 * - Bypass security monitoring
 */

/**
 * Sanitize a string for safe logging by removing/encoding control characters
 */
export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  let str: string;
  
  if (typeof value === 'string') {
    str = value;
  } else if (value instanceof Error) {
    // For errors, sanitize the message and stack separately
    const message = sanitizeString(value.message);
    const stack = value.stack ? sanitizeString(value.stack) : '';
    return stack ? `${message}\n${stack}` : message;
  } else if (typeof value === 'object') {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }

  return sanitizeString(str);
}

/**
 * Sanitize a string by removing/encoding dangerous characters
 */
function sanitizeString(str: string): string {
  const normalized = str
    // Replace newlines with escaped versions to prevent log forging
    .replace(/\r\n/g, '\\r\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    // Replace tabs
    .replace(/\t/g, '\\t');

  const withoutUnsafeChars = stripUnsafeChars(normalized);

  // Truncate very long strings to prevent log flooding
  return withoutUnsafeChars.slice(0, 10000);
}

/**
 * Secure console.log wrapper
 */
export function secureLog(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(sanitizeForLog);
  console.info(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Secure console.error wrapper
 */
export function secureError(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(sanitizeForLog);
  console.error(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Secure console.warn wrapper
 */
export function secureWarn(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(sanitizeForLog);
  console.warn(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Secure console.info wrapper
 */
export function secureInfo(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(sanitizeForLog);
  console.info(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Create a structured log entry (safe for JSON log aggregators)
 */
export function structuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeForLog(message),
    ...(metadata && {
      metadata: Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          sanitizeForLog(key),
          sanitizeForLog(value),
        ])
      ),
    }),
  };

  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logFn(JSON.stringify(entry));
}

function stripUnsafeChars(str: string): string {
  let sanitized = '';

  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);

    if (code === 0x1b) {
      i = skipAnsiEscapeSequence(str, i);
      continue;
    }

    if (isUnsafeControlCode(code)) {
      continue;
    }

    sanitized += str[i];
  }

  return sanitized;
}

function isUnsafeControlCode(code: number): boolean {
  const isControlCharacter = code >= 0x00 && code <= 0x1f;
  const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;

  return isControlCharacter && !isAllowedWhitespace;
}

function skipAnsiEscapeSequence(str: string, startIndex: number): number {
  if (str[startIndex + 1] !== '[') {
    return startIndex;
  }

  for (let i = startIndex + 2; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    const isTerminalByte =
      (code >= 0x41 && code <= 0x5a) || // A-Z
      (code >= 0x61 && code <= 0x7a); // a-z

    if (isTerminalByte) {
      return i;
    }
  }

  return str.length - 1;
}
