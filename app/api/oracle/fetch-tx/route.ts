import { NextRequest, NextResponse } from 'next/server';
import { OracleFetchTxRequestSchema, type ErrorResponse } from '@/lib/validation/schemas';
import { ProviderCascade } from '@/lib/providers/cascade';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { OracleSigner } from '@/lib/oracle/signer';
import type { Provider, ProviderError } from '@/lib/providers/types';

function mapErrorToResponse(error: unknown): {
  code: ErrorResponse['error']['code'];
  message: string;
  status: number;
} {
  const code: ErrorResponse['error']['code'] = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  const status = 500;

  if (!(error instanceof Error)) {
    return { code, message, status };
  }

  message = error.message;
  const normalizedMessage = message.toLowerCase();
  const providerCode = (error as Partial<ProviderError>).code;

  if (providerCode === 'NOT_FOUND') {
    return {
      code: 'TRANSACTION_NOT_FOUND',
      message,
      status: 404,
    };
  }

  if (providerCode === 'TIMEOUT') {
    return {
      code: 'PROVIDER_TIMEOUT',
      message,
      status: 504,
    };
  }

  if (providerCode === 'RATE_LIMIT') {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      status: 429,
    };
  }

  if (providerCode === 'PROVIDER_ERROR') {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
    };
  }

  if (
    normalizedMessage.includes('invalid') &&
    normalizedMessage.includes('transaction hash')
  ) {
    return {
      code: 'INVALID_HASH',
      message,
      status: 400,
    };
  }

  if (normalizedMessage.includes('not found')) {
    return {
      code: 'TRANSACTION_NOT_FOUND',
      message,
      status: 404,
    };
  }

  if (normalizedMessage.includes('timeout')) {
    return {
      code: 'PROVIDER_TIMEOUT',
      message,
      status: 504,
    };
  }

  if (
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests')
  ) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      status: 429,
    };
  }

  if (normalizedMessage.includes('provider')) {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
    };
  }

  return { code, message, status };
}

/**
 * POST /api/oracle/fetch-tx
 * 
 * Fetch canonical transaction data with oracle signature
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_HASH',
          message: 'Invalid JSON request body',
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate request body
    const validationResult = OracleFetchTxRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_HASH',
          message: 'Invalid request parameters',
          details: validationResult.error.flatten(),
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { chain, txHash } = validationResult.data;

    // Initialize providers based on chain
    let cascade: ProviderCascade;

    if (chain === 'bitcoin') {
      const providers = [new MempoolSpaceProvider()];
      cascade = new ProviderCascade(providers, {
        maxRetries: 3,
        retryDelayMs: 50,
        timeoutMs: 10000,
        concurrencyLimit: 5,
      });
    } else if (chain === 'ethereum') {
      const providers: Provider[] = [
        new EthereumPublicRpcProvider(),
      ];

      // Add Etherscan fallback if keys available
      const etherscanKeys = [
        process.env['ETHERSCAN_API_KEY_1'],
        process.env['ETHERSCAN_API_KEY_2'],
        process.env['ETHERSCAN_API_KEY_3'],
      ].filter((key): key is string => Boolean(key));

      if (etherscanKeys.length > 0) {
        providers.push(
          new EtherscanProvider({
            keys: etherscanKeys,
            rotationStrategy: 'round-robin',
            shuffleOnStartup: true,
          })
        );
      }

      cascade = new ProviderCascade(providers, {
        maxRetries: 3,
        retryDelayMs: 50,
        timeoutMs: 10000,
        concurrencyLimit: 5,
      });
    } else {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNSUPPORTED_CHAIN',
          message: `Unsupported chain: ${chain}`,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Fetch transaction with cascade
    const result = await cascade.fetchTransaction(txHash);

    // Sign canonical data
    const oraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
    if (!oraclePrivateKey) {
      throw new Error('Oracle private key not configured');
    }

    const signer = new OracleSigner(oraclePrivateKey);
    const signedPayload = signer.signCanonicalData(result.data);

    // Return signed payload
    return NextResponse.json({
      data: signedPayload,
      cached: result.cached,
    });
  } catch (error) {
    console.error('[Oracle API] Error:', error);

    const mapped = mapErrorToResponse(error);

    const errorResponse: ErrorResponse = {
      error: {
        code: mapped.code,
        message: mapped.message,
      },
    };

    return NextResponse.json(errorResponse, { status: mapped.status });
  }
}

export { mapErrorToResponse };
