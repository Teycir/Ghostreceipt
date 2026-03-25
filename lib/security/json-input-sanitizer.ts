export interface JsonInputSanitizationOptions {
  maxDepth: number;
  maxNodes: number;
}

const INVISIBLE_UNICODE_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const DANGEROUS_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function containsUnsafeControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isAsciiControl = (code >= 0x00 && code <= 0x1f) || code === 0x7f;
    if (!isAsciiControl) {
      continue;
    }

    // Allow tab/newline/carriage return for string values and keys.
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      continue;
    }

    return true;
  }

  return false;
}

function sanitizeStringValue(value: string): string {
  const sanitized = value.normalize('NFKC').trim();

  if (containsUnsafeControlChars(sanitized)) {
    throw new Error('JSON string contains unsafe control characters');
  }

  if (INVISIBLE_UNICODE_REGEX.test(sanitized)) {
    throw new Error('JSON string contains invisible Unicode characters');
  }

  return sanitized;
}

function validateObjectKey(key: string): void {
  if (DANGEROUS_JSON_KEYS.has(key)) {
    throw new Error('Potentially malicious JSON structure detected');
  }

  if (key !== key.trim()) {
    throw new Error('JSON key contains leading or trailing whitespace');
  }

  if (containsUnsafeControlChars(key)) {
    throw new Error('JSON key contains unsafe control characters');
  }

  if (INVISIBLE_UNICODE_REGEX.test(key)) {
    throw new Error('JSON key contains invisible Unicode characters');
  }
}

export function sanitizeAndValidateJsonInput(
  parsed: unknown,
  options: JsonInputSanitizationOptions
): unknown {
  const stack: Array<{
    depth: number;
    setValue?: (value: unknown) => void;
    value: unknown;
  }> = [{ depth: 0, value: parsed }];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (typeof current.value === 'string') {
      const sanitized = sanitizeStringValue(current.value);
      if (current.setValue && sanitized !== current.value) {
        current.setValue(sanitized);
      }
      continue;
    }

    if (current.value === null || typeof current.value !== 'object') {
      continue;
    }

    if (current.depth > options.maxDepth) {
      throw new Error(`JSON nesting too deep (max depth: ${options.maxDepth})`);
    }

    visitedNodes += 1;
    if (visitedNodes > options.maxNodes) {
      throw new Error(`JSON object too complex (max nodes: ${options.maxNodes})`);
    }

    if (Array.isArray(current.value)) {
      const currentArray = current.value;
      currentArray.forEach((item, index) => {
        stack.push({
          depth: current.depth + 1,
          setValue(nextValue: unknown): void {
            currentArray[index] = nextValue;
          },
          value: item,
        });
      });
      continue;
    }

    const currentObject = current.value as Record<string, unknown>;
    Object.entries(currentObject).forEach(([key, entryValue]) => {
      validateObjectKey(key);
      stack.push({
        depth: current.depth + 1,
        setValue(nextValue: unknown): void {
          currentObject[key] = nextValue;
        },
        value: entryValue,
      });
    });
  }

  return parsed;
}
