// Cloudflare Pages Function for Oracle Fetch API
// This replaces /app/api/oracle/fetch-tx/route.ts in static export

type OracleFetchContext = {
  request: Request;
};

export async function onRequest(context: OracleFetchContext): Promise<Response> {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { chain, txHash } = body as { chain?: string; txHash?: string };

    if (!chain || !txHash) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: chain, txHash' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: Import and use actual oracle logic from lib/oracle
    const response = {
      success: true,
      data: {
        chain,
        txHash,
        valueAtomic: '0',
        timestampUnix: Math.floor(Date.now() / 1000),
        confirmations: 0,
        blockNumber: 0,
        blockHash: '',
        messageHash: '',
        oracleSignature: '',
        oraclePubKeyId: '',
        signedAt: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
