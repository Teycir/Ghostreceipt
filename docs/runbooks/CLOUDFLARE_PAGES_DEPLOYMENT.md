# Cloudflare Pages Configuration for GhostReceipt

## Project Settings

- **Project Name**: `ghostreceipt`
- **Production Branch**: `main`
- **Production URL**: `https://ghostreceipt.pages.dev`

## Build Configuration

### Framework Preset
- **Framework**: Next.js (Static HTML Export)

### Build Settings
- **Build command**: `npm run build`
- **Build output directory**: `out`
- **Root directory**: `/` (project root)
- **Node version**: `20.9.0`
- **Wrangler config**: root `wrangler.toml` with `pages_build_output_dir = "out"` and `compatibility_flags = ["nodejs_compat"]`

## Environment Variables

Set these in Cloudflare Pages dashboard:
`Settings > Environment Variables`

### Public Variables (All Environments)
```
NEXT_PUBLIC_APP_URL=https://ghostreceipt.pages.dev
NEXT_PUBLIC_APP_NAME=GhostReceipt
# Optional edge backup base used by client failover logic.
# Leave empty to disable backup failover.
NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE=
```

### Production Environment Variables
```
ORACLE_PRIVATE_KEY=<your_oracle_private_key>
ETHERSCAN_API_KEY=<your_primary_etherscan_key>
ETHERSCAN_API_KEY_1=<your_fallback_key_1>
ETHERSCAN_API_KEY_2=<your_fallback_key_2>
HELIUS_API_KEY=<your_primary_helius_key>
HELIUS_API_KEY_1=<your_fallback_helius_key_1>
HELIUS_API_KEY_2=<your_fallback_helius_key_2>
BLOCKCYPHER_API_TOKEN=<your_primary_blockcypher_token>
BLOCKCYPHER_API_TOKEN_1=<your_fallback_blockcypher_token_1>

BITCOIN_PUBLIC_RPC_MEMPOOL_SPACE_MAINNET_URL=https://mempool.space/api
BITCOIN_PUBLIC_RPC_MEMPOOL_EMZY_MAINNET_URL=https://mempool.emzy.de/api
BITCOIN_PUBLIC_RPC_MEMPOOL_NINJA_MAINNET_URL=https://mempool.ninja/api
BITCOIN_PROVIDER_BLOCKCYPHER_MAINNET_URL=https://api.blockcypher.com/v1/btc/main

ETHEREUM_PUBLIC_RPC_PUBLICNODE_PRIMARY_URL=https://ethereum-rpc.publicnode.com
ETHEREUM_PUBLIC_RPC_PUBLICNODE_SECONDARY_URL=https://ethereum.publicnode.com
ETHEREUM_PUBLIC_RPC_FLASHBOTS_URL=https://rpc.flashbots.net
ETHEREUM_PUBLIC_RPC_CLOUDFLARE_URL=https://cloudflare-eth.com
ETHEREUM_PROVIDER_ETHERSCAN_V2_MAINNET_URL=https://api.etherscan.io/v2/api

SOLANA_PUBLIC_RPC_MAINNET_BETA_PRIMARY_URL=https://api.mainnet-beta.solana.com
SOLANA_PUBLIC_RPC_PUBLICNODE_URL=https://solana-rpc.publicnode.com
SOLANA_PROVIDER_CHAINSTACK_MAINNET_URL=<optional_chainstack_https_rpc_endpoint>
SOLANA_PROVIDER_HELIUS_MAINNET_URL=https://mainnet.helius-rpc.com/

ETHEREUM_PUBLIC_RPC_NAMES=PUBLICNODE_PRIMARY,PUBLICNODE_SECONDARY,FLASHBOTS,CLOUDFLARE
ETHEREUM_USDC_PUBLIC_RPC_NAMES=PUBLICNODE_PRIMARY,PUBLICNODE_SECONDARY,FLASHBOTS,CLOUDFLARE
SOLANA_PUBLIC_RPC_NAMES=MAINNET_BETA_PRIMARY,PUBLICNODE
BITCOIN_PUBLIC_RPC_NAMES=MEMPOOL_SPACE_MAINNET,MEMPOOL_EMZY_MAINNET,MEMPOOL_NINJA_MAINNET

ORACLE_VALIDATE_CONFIG_ON_LOAD=true
TRUST_PROXY_HEADERS=true
LOG_LEVEL=info
DEBUG=false
ORACLE_RATE_LIMIT_BACKEND=legacy
```

Recommended deployment path:
- Run `npm run cf:sync` from a fully configured `.env.local`.
- The sync script fails fast if required runtime keys/endpoints are missing.

Optional (only for durable backend rollout tests):
```
ORACLE_RATE_LIMIT_BACKEND=durable_prefer
ORACLE_RATE_LIMIT_DURABLE_URL=<durable_limiter_endpoint>
ORACLE_RATE_LIMIT_DURABLE_TIMEOUT_MS=120
ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS=5
ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS=30000
```

Optional (Solana consensus hardening tuning):
```
SOLANA_PUBLIC_RPC_REQUEST_THROTTLE_MS=500
SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES=2
SOLANA_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS=250
SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRIES=2
SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRY_DELAY_MS=800
SOLANA_CHAINSTACK_REQUEST_THROTTLE_MS=250
SOLANA_CHAINSTACK_ENDPOINT_RETRIES=1
SOLANA_CHAINSTACK_ENDPOINT_RETRY_DELAY_MS=250
```
When `SOLANA_PROVIDER_CHAINSTACK_MAINNET_URL` is set, Solana verification checks Chainstack first, then falls back to public RPC endpoints.

### Preview Environment Variables (Optional)
```
NEXT_PUBLIC_APP_URL=https://preview.ghostreceipt.pages.dev
ORACLE_PRIVATE_KEY=<staging_oracle_key>
ETHERSCAN_API_KEY=<staging_etherscan_key>
HELIUS_API_KEY=<staging_helius_key>
TRUST_PROXY_HEADERS=true
LOG_LEVEL=debug
DEBUG=true
```

## Deployment Steps

### 1. Connect Repository to Cloudflare Pages

1. Go to: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages
2. Click "Create a project"
3. Select "Connect to Git"
4. Choose your GitHub repository: `Teycir/GhostReceipt`
5. Configure build settings:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `/`

### 2. Set Environment Variables

1. Go to: `Settings > Environment Variables`
2. Add all variables listed above
3. Set different values for Production vs Preview environments

### 3. Deploy

- **Automatic**: Push to `main` branch triggers production deployment
- **Manual**: Click "Create deployment" in Pages dashboard

### GitHub Protection Baseline (Required)

Enforce strict branch protection on `main` so merge/deploy requires green CI:

```bash
npm run github:protect-main
```

Default required checks enforced by script:
- `Quality Gate`
- `Dependency Review`

### 4. Custom Domain (Optional)

1. Go to: `Custom domains`
2. Add: `ghostreceipt.com` or your custom domain
3. Follow DNS configuration instructions

## Cloudflare Pages Functions (API Routes)

With static export, oracle API endpoints are served from `functions/api/oracle/*` wrappers that delegate to canonical handlers in `app/api/oracle/*`.

Client runtime policy remains primary-first:
- Primary: `/api/oracle/*`
- Optional backup: `${NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE}/*` (only on transport/platform failures)

### Supported Routes
- `/api/oracle/fetch-tx` - Oracle transaction fetching endpoint
- `/api/oracle/verify-signature` - Oracle signature verification endpoint
- `/api/oracle/check-nullifier` - Nullifier conflict detection endpoint
- `/api/share-pointer/create` - Create compact short-link pointers for QR sharing
- `/api/share-pointer/resolve` - Resolve compact pointer IDs to proof payloads

### Required Binding For Compact QR Links

Compact `sid` verify links require durable storage. In Pages production/preview, bind D1 as `SHARE_POINTERS_DB`.

1. Create D1 database (one-time):
```bash
npx wrangler d1 create ghostreceipt-share-pointers
```
2. Add the binding in Cloudflare Pages:
`Settings > Functions > D1 bindings`
3. Binding name must be exactly:
`SHARE_POINTERS_DB`
4. Initialize schema:
```bash
npx wrangler d1 execute ghostreceipt-share-pointers --file=./scripts/sql/share-pointers.sql
```

Without this binding, compact QR short links are disabled and the API returns a configuration error instead of creating non-resolvable pointers.

## Monitoring

### Analytics
- https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt/analytics

### Deployment Logs
- https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages/view/ghostreceipt/deployments

### Real-time Logs
```bash
npx wrangler pages deployment tail
```

## Troubleshooting

### Build Fails
- Check Node.js version matches `.node-version` (20.9.0)
- Verify all dependencies in `package.json`
- Check build logs in deployment details

### Environment Variables Not Working
- Ensure variables are set in correct environment (Production/Preview)
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

### API Routes Not Working
- Verify wrappers exist in `functions/api/oracle/`
- Check function logs in deployment details
- Ensure environment variables are set
- Ensure `wrangler.toml` includes `compatibility_flags = ["nodejs_compat"]` for function bundling
- For compact QR links, ensure D1 binding `SHARE_POINTERS_DB` is set and database schema is applied
- If using backup failover, ensure `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE` points to a reachable deployment exposing `/fetch-tx`, `/verify-signature`, and `/check-nullifier`

### Static Assets Not Loading
- Verify `public/` directory structure
- Check build output includes static files
- Ensure paths are relative, not absolute

## Performance Optimization

### Caching
Cloudflare Pages automatically caches:
- Static assets (images, CSS, JS)
- HTML pages (with smart invalidation)

### Edge Network
- Global CDN with 300+ locations
- Automatic HTTPS
- HTTP/3 support

### Build Optimization
- Minimize bundle size
- Keep static assets cache-friendly

## Security

### Headers
Security headers are configured in `public/_headers`:
- HSTS
- X-Frame-Options
- CSP
- X-Content-Type-Options

### Secrets Management
- Never commit secrets to git
- Use Cloudflare Pages environment variables
- Rotate keys regularly
- Use different keys for production/preview

### Edge Rate-Limit Wall (Recommended)
- Add route-level edge rate-limit rules for:
  - `POST /api/oracle/fetch-tx`
  - `POST /api/oracle/verify-signature`
- Roll out in `Managed Challenge` mode first, then promote to `Block`.
- Runbook: [CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md](./CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md)

## Cost

Cloudflare Pages Free Tier:
- **Builds**: 500 builds/month
- **Bandwidth**: Unlimited
- **Requests**: Unlimited
- **Functions**: 100,000 requests/day

## Support

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Next.js on Pages: https://developers.cloudflare.com/pages/framework-guides/nextjs/
- Community: https://community.cloudflare.com/
