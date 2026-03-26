# Quick Deployment Guide - Cloudflare Pages

## 🚀 Deploy to Production NOW

### Option 1: Automatic Deployment (Recommended)

1. **Set GitHub Secret**
   ```bash
   # Go to: https://github.com/Teycir/GhostReceipt/settings/secrets/actions
   # Add secret: CLOUDFLARE_API_TOKEN
   # Get token from: https://dash.cloudflare.com/profile/api-tokens
   ```

2. **Use single-branch mode (`main` only)**
   - In GitHub branch settings, disable protection rules on `main` (no PR requirement, no required checks gate on GitHub side).
   - Local `pre-push` hook now enforces the full quality gate before any push.

3. **Push to main branch**
   ```bash
   git add .
   git commit -m "feat: add Cloudflare Pages deployment"
   git push origin main
   ```

4. **Verify local CI gate command (one-time)**
   ```bash
   npm run ci:quality-gate
   ```

5. **CI gate then deploy**
   - Local push is blocked unless `ci:quality-gate` passes.
   - Remote `CI` workflow still runs on push to `main`.
   - Deploy workflow starts only after successful CI on `main`.

### Option 2: Manual Deployment via Dashboard

1. **Go to Cloudflare Pages**
   - https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages

2. **Create Project**
   - Click "Create a project"
   - Select "Connect to Git"
   - Choose repository: `Teycir/GhostReceipt`
   - Branch: `main`

3. **Build Settings**
   ```
   Build command: npm run build
   Build output directory: .next
   Root directory: /
   ```

4. **Environment Variables** (Settings > Environment Variables)
   ```
   NEXT_PUBLIC_APP_URL=https://ghostreceipt.pages.dev
   NEXT_PUBLIC_APP_NAME=GhostReceipt
   NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE=
   ORACLE_PRIVATE_KEY=<your_key>
   ETHERSCAN_API_KEY=<your_key>
   ETHERSCAN_API_KEY_2=<your_key>
   ETHERSCAN_API_KEY_3=<your_key>
   TRUST_PROXY_HEADERS=true
   LOG_LEVEL=info
   DEBUG=false
   ```

5. **Deploy**
   - Click "Save and Deploy"

### Option 3: CLI Deployment

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login**
   ```bash
   wrangler login
   ```

3. **Deploy**
   ```bash
   npm run build
   npx wrangler pages deploy .next --project-name=ghostreceipt
   ```

## ✅ Pre-Deployment Checklist

Run this before deploying:
```bash
npm run ci:quality-gate && npm run deploy:check
```

This checks:
- ✓ Secrets/config guards (`check:secrets`, oracle log, verifier artifact)
- ✓ Node.js version (>= 20.9.0)
- ✓ Required files exist
- ✓ Dependencies installed
- ✓ Type check passes
- ✓ Linter passes
- ✓ Build succeeds
- ✓ No secrets in code

## 🔐 Required Secrets

Set these in Cloudflare Pages dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `ORACLE_PRIVATE_KEY` | ✓ | Oracle signing key (generate with `openssl rand -hex 32`) |
| `ETHERSCAN_API_KEY` | ✓ | Primary Etherscan API key |
| `ETHERSCAN_API_KEY_2` | ✓ | Fallback Etherscan API key |
| `ETHERSCAN_API_KEY_3` | ✓ | Fallback Etherscan API key |
| `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE` | - | Optional edge backup oracle base (`.../api/oracle`) |
| `TRUST_PROXY_HEADERS` | ✓ | Set to `true` for Cloudflare |
| `LOG_LEVEL` | - | `info` (production) or `debug` (preview) |
| `DEBUG` | - | `false` (production) or `true` (preview) |

## 🧪 Test Deployment

After deployment, test these endpoints:

1. **Homepage**
   ```bash
   curl https://ghostreceipt.pages.dev
   ```

2. **Oracle API**
   ```bash
   curl -X POST https://ghostreceipt.pages.dev/api/oracle/fetch-tx \
     -H "Content-Type: application/json" \
     -d '{
       "chain": "ethereum",
       "txHash": "0x..."
     }'
   ```

3. **Static Assets**
   ```bash
   curl https://ghostreceipt.pages.dev/zk/verification_key.json
   ```

## 📊 Monitor Deployment

- **Deployment Status**: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt/deployments
- **Analytics**: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt/analytics
- **Logs**: `npx wrangler pages deployment tail`

## 🐛 Troubleshooting

### Build Fails
```bash
# Test build locally
npm run build

# Check logs in Cloudflare dashboard
# Deployments > [Latest] > View details
```

### Environment Variables Not Working
```bash
# Verify variables are set
# Settings > Environment Variables

# Redeploy after adding variables
# Deployments > Retry deployment
```

### API Routes 404
```bash
# Ensure routes are in app/api/ directory
# Check function logs in deployment details
# If using edge backup failover, verify NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE is reachable
```

## 📚 Full Documentation

- [Cloudflare Pages Deployment Guide](./CLOUDFLARE_PAGES_DEPLOYMENT.md)
- [Cloudflare Workers Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md)
- [Security Runbook](./SECURITY.md)
- [Release Readiness Checklist](../project/RELEASE_READINESS_CHECKLIST.md)

## 🆘 Support

- **Issues**: https://github.com/Teycir/GhostReceipt/issues
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/
- **Community**: https://community.cloudflare.com/
