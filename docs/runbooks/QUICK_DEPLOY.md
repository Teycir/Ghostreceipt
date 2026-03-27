# Quick Deploy (Cloudflare Pages)

This is the fastest safe path to deploy GhostReceipt production.

## Prerequisites

- Cloudflare Pages project: `ghostreceipt`
- GitHub repo secrets configured:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Local runtime config present in `.env.local`

## Recommended Path (CI-gated deploy)

1. Run local checks:

```bash
npm run deploy:check
```

2. Sync runtime secrets/endpoints to Cloudflare Pages:

```bash
npm run cf:sync
```

3. Push to `main`.

Deploy runs automatically only after CI succeeds on `main`.

## Manual Pages Deploy (fallback)

Use this only when GitHub Actions is unavailable.

```bash
npm run build
npx wrangler pages deploy out --project-name=ghostreceipt --branch=main
```

## Verify Deployment

1. App loads:

```bash
curl -I https://ghostreceipt.pages.dev
```

2. Oracle route responds:

```bash
curl -X POST https://ghostreceipt.pages.dev/api/oracle/fetch-tx \
  -H "Content-Type: application/json" \
  -d '{"chain":"ethereum","txHash":"0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b"}'
```

3. Optional compact-link storage check:

- Confirm D1 binding exists in Pages functions settings as `SHARE_POINTERS_DB`.

## Troubleshooting

- Build mismatch: ensure output directory is `out`.
- Missing runtime vars/secrets: run `npm run cf:sync` and redeploy.
- `5xx` from oracle routes: validate env keys and endpoint URL vars from `.env.local`.

## Related Docs

- Full Pages deployment guide: [CLOUDFLARE_PAGES_DEPLOYMENT.md](./CLOUDFLARE_PAGES_DEPLOYMENT.md)
- Deployment checklist: [../DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)
- Security runbook: [SECURITY.md](./SECURITY.md)
- Edge rate-limit rules: [CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md](./CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md)
