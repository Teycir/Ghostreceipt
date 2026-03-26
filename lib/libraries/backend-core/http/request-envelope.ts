import { type NextRequest, type NextResponse } from 'next/server';
import { type ZodType } from 'zod';
import { type ErrorCode } from '@/lib/validation/schemas';
import { parseSecureJson, type SecureJsonOptions } from '@/lib/security/secure-json';
import { createJsonErrorResponse } from '@/lib/libraries/backend';

const DEFAULT_PARSE_MESSAGE_PREFIXES = [
  'Payload too large',
  'Invalid Content-Type',
  'Empty request body',
  'JSON object too complex',
  'JSON nesting too deep',
  'JSON string contains unsafe control characters',
  'JSON string contains invisible Unicode characters',
  'JSON key contains leading or trailing whitespace',
  'JSON key contains unsafe control characters',
  'JSON key contains invisible Unicode characters',
  'Potentially malicious JSON structure detected',
];

function mapParseErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const hasAllowedPrefix = DEFAULT_PARSE_MESSAGE_PREFIXES.some((prefix) =>
    error.message.startsWith(prefix)
  );
  if (hasAllowedPrefix) {
    return error.message;
  }

  return fallbackMessage;
}

export interface ParseSecureJsonWithErrorOptions extends SecureJsonOptions {
  code?: ErrorCode;
  fallbackMessage?: string;
  status?: number;
}

export async function parseSecureJsonWithError(
  request: NextRequest,
  {
    code = 'INVALID_HASH',
    fallbackMessage = 'Invalid JSON request body',
    status = 400,
    ...secureJsonOptions
  }: ParseSecureJsonWithErrorOptions = {}
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    return {
      ok: true,
      data: await parseSecureJson(request, secureJsonOptions),
    };
  } catch (error) {
    return {
      ok: false,
      response: createJsonErrorResponse({
        code,
        message: mapParseErrorMessage(error, fallbackMessage),
        status,
      }),
    };
  }
}

interface ValidateBodyWithSchemaOptions {
  code?: ErrorCode;
  message: string;
  status?: number;
}

export function validateBodyWithSchema<T>({
  body,
  options,
  schema,
}: {
  body: unknown;
  options: ValidateBodyWithSchemaOptions;
  schema: ZodType<T>;
}): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    response: createJsonErrorResponse({
      code: options.code ?? 'INVALID_HASH',
      details: parsed.error.flatten(),
      message: options.message,
      status: options.status ?? 400,
    }),
  };
}
