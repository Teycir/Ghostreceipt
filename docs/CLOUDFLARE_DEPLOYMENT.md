# Cloudflare Deployment (Canonical Paths)

This file is kept for compatibility with older links.

Use these current docs:

- Primary Pages deployment guide:
  - [runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md](./runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md)
- Fast production path:
  - [runbooks/QUICK_DEPLOY.md](./runbooks/QUICK_DEPLOY.md)
- Deployment checklist:
  - [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

Notes:
- GhostReceipt deploys as static export output `out`.
- Oracle APIs run via Cloudflare Pages Functions (`functions/api/*`).
- Runtime secrets/endpoints should be synced with `npm run cf:sync`.
