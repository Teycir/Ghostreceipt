#!/bin/bash
set -e

WRANGLER_CWD="${WRANGLER_CWD:-/tmp}"

wrangler_auth() {
    npx wrangler --cwd "$WRANGLER_CWD" "$@"
}

wrangler_pages() {
    npx wrangler "$@"
}

echo "🚀 GhostReceipt Deployment Script"
echo "=================================="

# Check if logged in
if ! wrangler_auth whoami &>/dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo "Run: npx wrangler login"
    exit 1
fi

# Check critical environment variables
if [ -z "$ORACLE_PRIVATE_KEY" ]; then
    echo "⚠️  ORACLE_PRIVATE_KEY not set locally"
    echo "Will be set via Cloudflare CLI during deployment"
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "⚠️  ETHERSCAN_API_KEY not set locally"
    echo "Will be set via Cloudflare CLI during deployment"
fi

# Run security checks
echo "🔒 Running security checks..."
npm run check:secrets

# Run tests
echo "🧪 Running tests..."
npm test

# Build
echo "🔨 Building static export..."
npm run build

# Deploy
echo "📦 Deploying to Cloudflare Pages..."
wrangler_pages pages deploy out --project-name=ghostreceipt

echo "✅ Deployment complete!"
echo "📊 Check status: https://dash.cloudflare.com/pages"
echo ""
echo "🔐 Set secrets via CLI:"
echo ""
echo "# Sync all secrets from .env.local"
echo "npm run cf:sync"
echo ""
echo "# Or set manually:"
echo "ORACLE_KEY=\$(openssl rand -hex 32)"
echo "echo \"\$ORACLE_KEY\" | npx wrangler pages secret put ORACLE_PRIVATE_KEY --project-name=ghostreceipt"
echo "echo \"your_key\" | npx wrangler pages secret put ETHERSCAN_API_KEY --project-name=ghostreceipt"
echo ""
echo "# Verify secrets"
echo "npx wrangler pages secret list --project-name=ghostreceipt"
echo ""
echo "⚡ Quick setup: npm run cf:setup (auto-syncs from .env.local)"
