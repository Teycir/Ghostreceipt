# Cloudflare Pages Deployment Checklist

## Pre-Deployment

### Code Preparation
- [x] Static export configured in `next.config.mjs`
- [x] Security headers in `/public/_headers`
- [x] SPA redirects in `/public/_redirects`
- [x] `.cfignore` excludes unnecessary files
- [ ] Cloudflare Functions implement oracle logic
- [ ] All tests passing
- [ ] Security audit completed

### Environment Setup
- [ ] Cloudflare account created
- [ ] Wrangler CLI authenticated (`npx wrangler login`)
- [ ] Project name decided (default: `ghostreceipt`)
- [ ] Decide backup edge oracle base (`NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE`) or keep disabled

## Initial Deployment

### 1. Build and Deploy
```bash
npm run build
npx wrangler pages deploy out --project-name=ghostreceipt
```

### 2. Configure Secrets from Local Environment

**Sync from .env.local:**
```bash
npm run cf:sync
```

This automatically syncs all secrets from your local `.env.local` file to Cloudflare.

**Verify Secrets:**
```bash
npx wrangler pages secret list --project-name=ghostreceipt
```

### 3. Verify Deployment
- [ ] Visit production URL
- [ ] Test generator flow
- [ ] Test verifier flow
- [ ] Check browser console for errors
- [ ] Verify security headers (use securityheaders.com)
- [ ] Test API endpoints

## GitHub Actions Setup

### Required Secrets
Set in: Repository → Settings → Secrets and variables → Actions

- [ ] `CLOUDFLARE_API_TOKEN` - Create at dash.cloudflare.com → My Profile → API Tokens
- [ ] `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare dashboard URL
- [ ] `NEXT_PUBLIC_APP_URL` - Production URL (optional)

### Verify CI/CD
- [ ] CI (`Quality Gate`) passes on `main`
- [ ] Deploy workflow runs only after CI success (`workflow_run` gate)
- [ ] PRs run CI only (no Cloudflare deploy on PR events)
- [ ] Check Actions tab for workflow status
- [ ] Verify deployment in Cloudflare dashboard
- [ ] Branch protection enabled on `main` with required checks:
  - `Quality Gate`
  - `Dependency Review`

Apply/refresh branch protection via script:
```bash
npm run github:protect-main
```

### Fix CI/CD Break (Missing `apiToken`)
1. [ ] Add required GitHub Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
2. [ ] Re-run the failed workflow:
   - GitHub → Actions → `Deploy to Cloudflare Pages` → **Re-run jobs**
3. [ ] If the failed run was a PR event, push to `main` to trigger automated deploy in secret-enabled context

## Custom Domain (Optional)

### Add Domain
1. [ ] Cloudflare Pages → Custom domains → Add domain
2. [ ] Configure DNS records as instructed
3. [ ] Wait for SSL certificate provisioning
4. [ ] Update `NEXT_PUBLIC_APP_URL` to custom domain

## Post-Deployment

### Security Verification
- [ ] HTTPS enforced
- [ ] Security headers active (check with curl or browser devtools)
- [ ] CSP not blocking required resources
- [ ] CORS configured correctly for API routes
- [ ] Rate limiting tested
- [ ] Cloudflare edge rate-limit rules active for `/api/oracle/fetch-tx` and `/api/oracle/verify-signature`

### Functionality Testing
- [ ] BTC receipt generation works
- [ ] ETH receipt generation works
- [ ] Proof verification works
- [ ] QR code generation works
- [ ] Share links work
- [ ] Static docs pages load
- [ ] Primary oracle routes (`/api/oracle/*`) respond correctly
- [ ] If backup enabled: edge backup base responds with matching contract
- [ ] If backup enabled: simulated primary `503` fails over to backup
- [ ] Verify primary `429` does not trigger backup failover

### Monitoring Setup
- [ ] Cloudflare Analytics enabled
- [ ] Error tracking configured
- [ ] Uptime monitoring (optional)

### Documentation
- [ ] Update README.md with production URL
- [ ] Update docs with deployment info
- [ ] Document rollback procedure
- [ ] Share deployment guide with team

## Rollback Plan

If issues occur:

```bash
# List deployments
npx wrangler pages deployment list --project-name=ghostreceipt

# Rollback to previous deployment
npx wrangler pages deployment rollback <DEPLOYMENT_ID> --project-name=ghostreceipt
```

## Maintenance

### Regular Tasks
- [ ] Monitor Cloudflare Analytics weekly
- [ ] Review error logs
- [ ] Update dependencies monthly
- [ ] Rotate oracle keys quarterly (see SECURITY.md)
- [ ] Test backup/restore procedures

### Emergency Contacts
- Cloudflare Support: https://dash.cloudflare.com/support
- GitHub Issues: https://github.com/teycir/GhostReceipt/issues

## Resources

- [Cloudflare Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md)
- [Cloudflare Edge Rate-Limit Rules](./runbooks/CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md)
- [Oracle Fail-Safe Architecture](./runbooks/ORACLE_FAILSAFE_ARCHITECTURE.md)
- [Security Runbook](./runbooks/SECURITY.md)
- [Threat Model](./runbooks/THREAT_MODEL.md)
- [Release Readiness](./project/RELEASE_READINESS_CHECKLIST.md)
