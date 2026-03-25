# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions that replace Next.js API routes for static export deployment.

## Structure

```
functions/
└── api/
    └── oracle/
        ├── check-nullifier.ts # POST /api/oracle/check-nullifier
        ├── fetch-tx.ts       # POST /api/oracle/fetch-tx
        └── verify-signature.ts # POST /api/oracle/verify-signature
```

## How It Works

Cloudflare Pages automatically serves files in `/functions` as serverless functions:
- `functions/api/oracle/check-nullifier.ts` → `/api/oracle/check-nullifier`
- `functions/api/oracle/fetch-tx.ts` → `/api/oracle/fetch-tx`
- `functions/api/oracle/verify-signature.ts` → `/api/oracle/verify-signature`

Fail-safe policy:
- Client primary path is `/api/oracle/*`.
- Optional edge backup can be configured with `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE`.
- Backup is only attempted for transport/platform failures (`network`, `404/405`, `5xx`), not normal `4xx` responses.

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

Current Pages functions implement production oracle behavior directly for static-export deployments:
1. thin route entrypoints under `functions/api/oracle/*`,
2. shared modular logic in `lib/libraries/backend-core/http/pages/*`,
3. route-level in-memory rate limits and replay/nullifier guards,
4. Cloudflare `context.env` hydration via process env compatibility.

The App Router handlers in `app/api/oracle/*` remain the source of truth for Next server mode, while the reusable modules in `lib/libraries/backend-core/http/pages/*` provide static-mode runtime parity for Cloudflare Pages and other edge projects.

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
