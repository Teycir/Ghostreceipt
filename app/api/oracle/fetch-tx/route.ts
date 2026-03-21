import { NextRequest, NextResponse } from 'next/server';
import { OracleFetchTxRequestSchema, type ErrorResponse } from '@/lib/validation/schemas';
import { ProviderCascade } from '@/lib/providers/cascade';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { OracleSigner } from '@/lib/oracle/signer';
import type { Provider } from '@/lib/providers/types';

/**
 * POST /api/oracle/fetch-tx
 * 
 * Fetch canonical transaction data with oracle signature
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json();
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

    // Determine error code
    let errorCode: ErrorResponse['error']['code'] = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (error instanceof Error) {
      message = error.message;

      if (message.includes('not found')) {
        errorCode = 'TRANSACTION_NOT_FOUND';
      } else if (message.includes('timeout')) {
        errorCode = 'PROVIDER_TIMEOUT';
      } else if (message.includes('rate limit')) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (message.includes('provider')) {
        errorCode = 'PROVIDER_ERROR';
      }
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: errorCode,
        message,
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
