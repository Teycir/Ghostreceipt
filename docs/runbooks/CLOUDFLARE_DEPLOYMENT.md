# Cloudflare Deployment Guide

## Account Information

- **Account ID**: `8f49c311ff2506c6020f060b8c1da686`
- **Dashboard**: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/home/overview

## Prerequisites

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

## Setup KV Namespaces

Create KV namespaces for caching:

```bash
# Development
wrangler kv:namespace create CACHE

# Staging
wrangler kv:namespace create CACHE --env staging

# Production
wrangler kv:namespace create CACHE --env production
```

Copy the namespace IDs from the output and update `wrangler.toml`.

## Set Secrets

Set environment secrets (never commit these):

```bash
# Oracle private key
wrangler secret put ORACLE_PRIVATE_KEY

# Etherscan API keys
wrangler secret put ETHERSCAN_API_KEY_1
wrangler secret put ETHERSCAN_API_KEY_2
wrangler secret put ETHERSCAN_API_KEY_3

```

For production environment:
```bash
wrangler secret put ORACLE_PRIVATE_KEY --env production
wrangler secret put ETHERSCAN_API_KEY_1 --env production
# ... repeat for all secrets
```

## Deploy

### Development
```bash
wrangler deploy
```

### Staging
```bash
wrangler deploy --env staging
```

### Production
```bash
wrangler deploy --env production
```

## Test Deployment

```bash
# Test the oracle endpoint
curl https://ghostreceipt-oracle.your-subdomain.workers.dev/api/oracle/fetch-tx \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "ethereum",
    "txHash": "0x..."
  }'
```

## Monitoring

View logs:
```bash
wrangler tail
wrangler tail --env production
```

View analytics:
- https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/workers/analytics

## Rollback

If deployment fails:
```bash
wrangler rollback
wrangler rollback --env production
```

## Local Development

Run worker locally:
```bash
wrangler dev
```

This starts a local server at `http://localhost:8787`

## Environment Variables

Set in `wrangler.toml` under `[vars]`:
- `ENVIRONMENT`: "development" | "staging" | "production"
- Optional client failover target:
  - Set `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE` in the web app deployment to this worker's oracle base URL (`https://<worker-host>/api/oracle`) if this worker is used as edge backup.

Set as secrets (via `wrangler secret put`):
- `ORACLE_PRIVATE_KEY`: Oracle signing key
- `ETHERSCAN_API_KEY_1`: Primary Etherscan key
- `ETHERSCAN_API_KEY_2`: Fallback Etherscan key
- `ETHERSCAN_API_KEY_3`: Fallback Etherscan key

## Troubleshooting

### Authentication Issues
```bash
wrangler logout
wrangler login
```

### KV Namespace Issues
List all namespaces:
```bash
wrangler kv:namespace list
```

### View Worker Logs
```bash
wrangler tail --format pretty
```

### Check Deployment Status
```bash
wrangler deployments list
```

## Cost Optimization

- **Workers**: 100,000 requests/day free
- **KV**: 100,000 reads/day free, 1,000 writes/day free
- **Cache TTL**: Set to 1 hour to minimize KV writes

## Security

- Never commit secrets to git
- Rotate API keys regularly
- Use different keys for staging/production
- Monitor usage in Cloudflare dashboard
