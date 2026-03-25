# 🚀 GhostReceipt Production Deployment - Ready to Deploy!

## ✅ Status: All Pre-Deployment Checks Passed

Your project is ready for production deployment to `ghostreceipt.pages.dev`

## 🎯 Choose Your Deployment Method

### Method 1: Automatic via GitHub Actions (Recommended)

**Setup once, deploy automatically on every push to main**

1. **Add Cloudflare API Token to GitHub**
   - Go to: https://github.com/Teycir/GhostReceipt/settings/secrets/actions
   - Click "New repository secret"
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Get from https://dash.cloudflare.com/profile/api-tokens
     - Click "Create Token"
     - Use "Edit Cloudflare Workers" template
     - Account: Select your account
     - Zone: All zones
     - Create token and copy it

2. **Push to main branch**
   ```bash
   git add .
   git commit -m "feat: add Cloudflare Pages deployment configuration"
   git push origin main
   ```

3. **Watch deployment**
   - GitHub Actions: https://github.com/Teycir/GhostReceipt/actions
   - Cloudflare: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages

---

### Method 2: Manual via Cloudflare Dashboard

**One-time setup through web interface**

1. **Go to Cloudflare Pages**
   - https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages

2. **Create Project**
   - Click "Create a project"
   - Select "Connect to Git"
   - Authorize GitHub access
   - Select repository: `Teycir/GhostReceipt`
   - Click "Begin setup"

3. **Configure Build**
   ```
   Production branch: main
   Build command: npm run build
   Build output directory: .next
   Root directory: /
   ```

4. **Add Environment Variables**
   Click "Environment variables (advanced)" and add:
   
   **Production Environment:**
   ```
   NEXT_PUBLIC_APP_URL=https://ghostreceipt.pages.dev
   NEXT_PUBLIC_APP_NAME=GhostReceipt
   NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE=
   ORACLE_PRIVATE_KEY=<generate with: openssl rand -hex 32>
   ETHERSCAN_API_KEY=<your_primary_key>
   ETHERSCAN_API_KEY_2=<your_fallback_key>
   ETHERSCAN_API_KEY_3=<your_fallback_key>
   TRUST_PROXY_HEADERS=true
   LOG_LEVEL=info
   DEBUG=false
   ```

5. **Deploy**
   - Click "Save and Deploy"
   - Wait 2-3 minutes for build to complete

---

### Method 3: CLI Deployment

**Quick deployment from terminal**

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build project
npm run build

# Deploy to Pages
npx wrangler pages deploy .next --project-name=ghostreceipt
```

---

## 🔐 Required Environment Variables

You MUST set these in Cloudflare Pages dashboard after deployment:

| Variable | Required | How to Get |
|----------|----------|------------|
| `ORACLE_PRIVATE_KEY` | ✓ | Generate: `openssl rand -hex 32` |
| `ETHERSCAN_API_KEY` | ✓ | Get from: https://etherscan.io/myapikey |
| `ETHERSCAN_API_KEY_2` | ✓ | Get from: https://etherscan.io/myapikey |
| `ETHERSCAN_API_KEY_3` | ✓ | Get from: https://etherscan.io/myapikey |
| `TRUST_PROXY_HEADERS` | ✓ | Set to: `true` |
| `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE` | - | Optional backup base (`https://.../api/oracle`) |
| `LOG_LEVEL` | - | Set to: `info` |
| `DEBUG` | - | Set to: `false` |

**To add variables after deployment:**
1. Go to: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt
2. Click "Settings" > "Environment variables"
3. Add each variable
4. Click "Save"
5. Redeploy: "Deployments" > "Retry deployment"

---

## 🧪 Post-Deployment Testing

After deployment completes, test these:

### 1. Homepage
```bash
curl https://ghostreceipt.pages.dev
# Should return HTML
```

### 2. Oracle API
```bash
curl -X POST https://ghostreceipt.pages.dev/api/oracle/fetch-tx \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "ethereum",
    "txHash": "0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b"
  }'
# Should return oracle-signed transaction data
```

### 3. Static Assets
```bash
curl https://ghostreceipt.pages.dev/zk/verification_key.json
# Should return verification key JSON
```

### 4. Generator Page
Open in browser: https://ghostreceipt.pages.dev/generator

### 5. Verify Page
Open in browser: https://ghostreceipt.pages.dev/verify

---

## 📊 Monitor Your Deployment

- **Deployment Status**: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt/deployments
- **Analytics**: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt/analytics
- **Real-time Logs**: `npx wrangler pages deployment tail`
- **GitHub Actions**: https://github.com/Teycir/GhostReceipt/actions

---

## 🎉 What You Get

- ✅ Global CDN with 300+ edge locations
- ✅ Automatic HTTPS
- ✅ Unlimited bandwidth
- ✅ Unlimited requests
- ✅ 500 builds/month (free tier)
- ✅ Automatic deployments on git push
- ✅ Preview deployments for PRs
- ✅ Rollback capability
- ✅ Built-in analytics

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Test locally first
npm run build

# Check build logs in Cloudflare dashboard
# Deployments > [Latest] > View build log
```

### Environment Variables Not Working
- Ensure variables are set in correct environment (Production/Preview)
- Variable names are case-sensitive
- Redeploy after adding new variables

### API Routes Return 404
- Verify routes are in `app/api/` directory
- Check function logs in deployment details
- Ensure environment variables are set
- If backup failover is enabled, confirm `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE` points to a reachable deployment

### Static Files Not Loading
- Check `public/` directory structure
- Verify build output includes files
- Check browser console for errors

---

## 📚 Documentation

- [Quick Deploy Guide](./docs/runbooks/QUICK_DEPLOY.md)
- [Full Cloudflare Pages Guide](./docs/runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md)
- [Security Runbook](./docs/runbooks/SECURITY.md)
- [Release Checklist](./docs/project/RELEASE_READINESS_CHECKLIST.md)

---

## 🆘 Need Help?

- **GitHub Issues**: https://github.com/Teycir/GhostReceipt/issues
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/
- **Cloudflare Community**: https://community.cloudflare.com/

---

## 🚀 Ready to Deploy?

Run the pre-deployment check one more time:
```bash
npm run deploy:check
```

Then choose your deployment method above and go live! 🎉
