# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions that replace Next.js API routes for static export deployment.

## Structure

```
functions/
└── api/
    └── oracle/
        ├── fetch-tx.ts       # POST /api/oracle/fetch-tx
        └── verify-signature.ts # POST /api/oracle/verify-signature
```

## How It Works

Cloudflare Pages automatically serves files in `/functions` as serverless functions:
- `functions/api/oracle/fetch-tx.ts` → `/api/oracle/fetch-tx`
- `functions/api/oracle/verify-signature.ts` → `/api/oracle/verify-signature`

## Environment Variables

Functions access environment variables via `context.env`:

```typescript
export async function onRequest(context) {
  const { request, env } = context;
  const oracleKey = env.ORACLE_PRIVATE_KEY;
  // ...
}
```

## Migration Status

⚠️ **TODO**: These are placeholder implementations. Need to:

1. Import oracle logic from `/lib/oracle`
2. Import provider logic from `/lib/providers`
3. Handle Ed25519 signing (may need WASM or native crypto)
4. Implement rate limiting with KV or Durable Objects
5. Add proper error handling per error-handling.md rules

## Local Development

Test with Cloudflare Pages dev server:

```bash
npm run build
npm run pages:dev
```

## Deployment

Functions are automatically deployed with Pages:

```bash
npm run deploy
```

## Resources

- [Cloudflare Pages Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [Functions API Reference](https://developers.cloudflare.com/pages/functions/api-reference/)
