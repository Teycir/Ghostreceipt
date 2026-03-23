// Cloudflare Pages Function for Oracle Verify Signature API

type OracleVerifyContext = {
  request: Request;
};

export async function onRequest(context: OracleVerifyContext): Promise<Response> {
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
    const { messageHash, oracleSignature, oraclePubKeyId } = body as {
      messageHash?: string;
      oracleSignature?: string;
      oraclePubKeyId?: string;
    };

    if (!messageHash || !oracleSignature || !oraclePubKeyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: Import and use actual verification logic from lib/oracle
    const response = {
      valid: true,
      oraclePubKeyId,
      verifiedAt: new Date().toISOString(),
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
