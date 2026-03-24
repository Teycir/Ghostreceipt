# Cloudflare Pages Deployment Guide

## Prerequisites

1. Cloudflare account with Pages enabled
2. Wrangler CLI installed: `npm install -g wrangler`
3. Authenticated: `npx wrangler login`

## Quick Deploy

```bash
# Sync all secrets from .env.local to Cloudflare (recommended)
npm run cf:sync

# Then deploy
npm run deploy

# Or do both with interactive setup
npm run cf:setup

# Manage secrets interactively
npm run cf:secrets

# Deploy preview branch
npm run deploy:preview

# Test locally with Cloudflare Pages environment
npm run pages:dev
```

## Manual Setup

### 1. Create Cloudflare Pages Project

```bash
# Login to Cloudflare
npx wrangler login

# Deploy for the first time
npm run build
npx wrangler pages deploy out --project-name=ghostreceipt
```

### 2. Sync Secrets from Local Environment

**Automatic sync from .env.local:**

```bash
# Sync all secrets from .env.local to Cloudflare
npm run cf:sync
```

This will automatically set:
- `ORACLE_PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `ETHERSCAN_API_KEY_1` through `ETHERSCAN_API_KEY_6` (if defined)
- `HELIUS_API_KEY`
- `HELIUS_API_KEY_1` through `HELIUS_API_KEY_6` (if defined)
- `BLOCKCHAIR_API_KEY` (if defined)

**Manual CLI commands:**

```bash
# Generate and set oracle private key
ORACLE_KEY=$(openssl rand -hex 32)
echo "$ORACLE_KEY" | npx wrangler pages secret put ORACLE_PRIVATE_KEY --project-name=ghostreceipt

# Set Etherscan API key
echo "your_etherscan_key_here" | npx wrangler pages secret put ETHERSCAN_API_KEY --project-name=ghostreceipt
```

**Optional Secrets:**

```bash
# Fallback Etherscan keys
echo "fallback_key_1" | npx wrangler pages secret put ETHERSCAN_API_KEY_1 --project-name=ghostreceipt
echo "fallback_key_2" | npx wrangler pages secret put ETHERSCAN_API_KEY_2 --project-name=ghostreceipt
echo "fallback_key_3" | npx wrangler pages secret put ETHERSCAN_API_KEY_3 --project-name=ghostreceipt

# Fallback Helius keys
echo "fallback_helius_1" | npx wrangler pages secret put HELIUS_API_KEY_1 --project-name=ghostreceipt
echo "fallback_helius_2" | npx wrangler pages secret put HELIUS_API_KEY_2 --project-name=ghostreceipt
echo "fallback_helius_3" | npx wrangler pages secret put HELIUS_API_KEY_3 --project-name=ghostreceipt

# BTC fallback provider
echo "blockchair_key" | npx wrangler pages secret put BLOCKCHAIR_API_KEY --project-name=ghostreceipt
```

**Public Variables:**

```bash
# Set via wrangler.toml [vars] section or dashboard
# NEXT_PUBLIC_APP_URL - Production URL (e.g., https://ghostreceipt.pages.dev)
# TRUST_PROXY_HEADERS - Set to "true" for Cloudflare
```

### 3. Verify Secrets

```bash
# List all secrets (values are hidden)
npx wrangler pages secret list --project-name=ghostreceipt
```

## GitHub Actions Deployment

The repository includes automated deployment via GitHub Actions.

### Required GitHub Secrets

Set these in GitHub repository settings (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `NEXT_PUBLIC_APP_URL` - Production URL (optional, defaults to ghostreceipt.pages.dev)

### Create Cloudflare API Token

1. Go to Cloudflare dashboard → My Profile → API Tokens
2. Create Token → Use "Edit Cloudflare Workers" template
3. Add "Cloudflare Pages" permissions:
   - Account → Cloudflare Pages → Edit
4. Copy token and add to GitHub secrets

## Custom Domain

### Add Custom Domain

1. Go to Cloudflare Pages dashboard
2. Select your project → Custom domains
3. Add your domain (e.g., `ghostreceipt.com`)
4. Follow DNS configuration instructions

### Update Environment Variables

After adding custom domain, update:
- `NEXT_PUBLIC_APP_URL` to your custom domain

## Security Headers

Security headers are configured in `/public/_headers` and automatically applied by Cloudflare Pages:

- HSTS with preload
- CSP with strict policies
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- CORS policies for oracle APIs

## Caching Strategy

- `/zk/*` - Immutable, 1 year cache
- `/static/*` - Immutable, 1 year cache
- `/docs/*` - 1 hour cache
- API routes - No cache

## Monitoring

### View Deployment Logs

```bash
npx wrangler pages deployment list --project-name=ghostreceipt
```

### View Analytics

1. Cloudflare dashboard → Pages
2. Select project → Analytics

## Rollback

```bash
# List deployments
npx wrangler pages deployment list --project-name=ghostreceipt

# Rollback to specific deployment
npx wrangler pages deployment rollback <DEPLOYMENT_ID> --project-name=ghostreceipt
```

## Troubleshooting

### Build Fails

- Ensure `output: 'export'` is set in `next.config.mjs`
- Check that all dependencies are in `package.json`
- Verify Node version matches `.nvmrc` (20.9.0+)

### Environment Variables Not Working

- Secrets must be set in Cloudflare dashboard, not in code
- Public variables must start with `NEXT_PUBLIC_`
- Restart deployment after changing variables

### API Routes Not Working

- Cloudflare Pages doesn't support Next.js API routes in static export
- Use Cloudflare Functions in `/functions` directory instead
- Or deploy API separately as Cloudflare Worker

### CSP Violations

- Check browser console for blocked resources
- Update CSP in `/public/_headers`
- Add required domains to `connect-src` directive

## Production Checklist

- [ ] All secrets configured in Cloudflare dashboard
- [ ] Custom domain configured (if applicable)
- [ ] DNS records pointing to Cloudflare Pages
- [ ] SSL/TLS certificate active
- [ ] Security headers verified
- [ ] Analytics enabled
- [ ] Error tracking configured
- [ ] Backup oracle key stored securely
- [ ] Rate limiting tested
- [ ] ZK circuits verified and uploaded
- [ ] Documentation updated with production URL

## Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [GhostReceipt Security Runbook](./docs/runbooks/SECURITY.md)
