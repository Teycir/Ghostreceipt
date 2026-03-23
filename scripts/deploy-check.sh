#!/bin/bash
# GhostReceipt Cloudflare Pages Deployment Checklist

set -e

echo "🚀 GhostReceipt Cloudflare Pages Deployment Checklist"
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="20.9.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION (>= $REQUIRED_VERSION)"
else
    echo -e "${RED}✗${NC} Node.js version: $NODE_VERSION (requires >= $REQUIRED_VERSION)"
    exit 1
fi

# Check if .env.local exists
echo ""
echo "🔐 Checking environment configuration..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
else
    echo -e "${YELLOW}⚠${NC} .env.local not found (required for local testing)"
fi

# Check required files
echo ""
echo "📄 Checking required files..."
REQUIRED_FILES=(
    "package.json"
    "next.config.mjs"
    ".node-version"
    "public/zk/verification_key.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file missing"
        exit 1
    fi
done

# Check dependencies
echo ""
echo "📚 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists"
else
    echo -e "${YELLOW}⚠${NC} node_modules not found. Run: npm install"
    exit 1
fi

# Run type check
echo ""
echo "🔍 Running type check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Type check passed"
else
    echo -e "${RED}✗${NC} Type check failed. Run: npm run typecheck"
    exit 1
fi

# Run linter
echo ""
echo "🧹 Running linter..."
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Linter passed"
else
    echo -e "${YELLOW}⚠${NC} Linter warnings/errors found. Run: npm run lint"
fi

# Run stress integration tests
echo ""
echo "⚡ Running stress integration tests..."
if npm run test:stress:oracle > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Stress integration tests passed"
else
    echo -e "${RED}✗${NC} Stress integration tests failed. Run: npm run test:stress:oracle"
    exit 1
fi

# Test build
echo ""
echo "🏗️  Testing production build..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}✗${NC} Build failed. Run: npm run build"
    exit 1
fi

# Check secrets
echo ""
echo "🔒 Checking for exposed secrets..."
if bash scripts/check-secrets.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} No secrets found in code"
else
    echo -e "${RED}✗${NC} Potential secrets found. Run: npm run check:secrets"
    exit 1
fi

# Deployment instructions
echo ""
echo "======================================================"
echo -e "${GREEN}✓ All checks passed!${NC}"
echo ""
echo "📋 Next Steps for Cloudflare Pages Deployment:"
echo ""
echo "1. Go to: https://dash.cloudflare.com/8f49c311ff2506c6020f060b8c1da686/pages"
echo ""
echo "2. Create new project or select 'ghostreceipt'"
echo ""
echo "3. Set environment variables in Pages dashboard:"
echo "   - NEXT_PUBLIC_APP_URL=https://ghostreceipt.pages.dev"
echo "   - NEXT_PUBLIC_APP_NAME=GhostReceipt"
echo "   - ORACLE_PRIVATE_KEY=<your_key>"
echo "   - ETHERSCAN_API_KEY=<your_key>"
echo "   - ETHERSCAN_API_KEY_2=<your_key>"
echo "   - ETHERSCAN_API_KEY_3=<your_key>"
echo "   - TRUST_PROXY_HEADERS=true"
echo "   - LOG_LEVEL=info"
echo "   - DEBUG=false"
echo ""
echo "4. Configure build settings:"
echo "   - Build command: npm run build"
echo "   - Build output directory: .next"
echo "   - Root directory: /"
echo ""
echo "5. Deploy:"
echo "   - Push to 'main' branch for automatic deployment"
echo "   - Or click 'Create deployment' in dashboard"
echo ""
echo "6. Verify deployment:"
echo "   - Check https://ghostreceipt.pages.dev"
echo "   - Test API: https://ghostreceipt.pages.dev/api/oracle/fetch-tx"
echo ""
echo "📖 Full guide: docs/runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md"
echo "======================================================"
