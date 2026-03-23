#!/bin/bash
# Quick deployment setup for GhostReceipt on Cloudflare Pages

set -e

WRANGLER_CWD="${WRANGLER_CWD:-/tmp}"

wrangler_auth() {
    npx wrangler --cwd "$WRANGLER_CWD" "$@"
}

wrangler_pages() {
    npx wrangler "$@"
}

echo "🔧 GhostReceipt Cloudflare Setup"
echo "================================"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install Node.js 20.9.0+"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found"; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Check if logged in
if ! wrangler_auth whoami &>/dev/null; then
    echo "🔐 Logging in to Cloudflare..."
    npx wrangler --cwd "$WRANGLER_CWD" login
else
    echo "✅ Already logged in to Cloudflare"
fi

echo ""
echo "📋 Setup Steps:"
echo ""
echo "1. Generate Oracle Private Key"
ORACLE_KEY=$(openssl rand -hex 32)
echo "   Generated: $ORACLE_KEY"
echo "   ⚠️  Save this securely! You'll need it for Cloudflare secrets."
echo ""

echo "2. Get Etherscan API Key"
echo "   Visit: https://etherscan.io/myapikey"
echo "   Create a free API key"
echo ""

read -p "Press Enter when you have your Etherscan API key..."
echo ""

echo "3. Building project..."
npm run build

echo ""
echo "4. Deploying to Cloudflare Pages..."
wrangler_pages pages deploy out --project-name=ghostreceipt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔐 Syncing secrets from local environment..."
echo ""
npm run cf:sync

echo ""
echo "✅ Secrets configured!"
echo ""
echo "Verifying secrets..."
wrangler_pages pages secret list --project-name=ghostreceipt

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Set public environment variables in Cloudflare dashboard:"
echo "   https://dash.cloudflare.com/pages"
echo "   - NEXT_PUBLIC_APP_URL: https://ghostreceipt.pages.dev"
echo "   - TRUST_PROXY_HEADERS: true"
echo ""
echo "2. Test your deployment:"
echo "   Visit: https://ghostreceipt.pages.dev"
