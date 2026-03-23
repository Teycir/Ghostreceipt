#!/bin/bash
# Security Audit - Verify no sensitive data in git

set -e

echo "🔒 GhostReceipt Security Audit"
echo "=============================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUES_FOUND=0

# Check 1: Verify .gitignore protects sensitive files
echo "1️⃣  Checking .gitignore protection..."
SENSITIVE_FILES=(".env" ".env.local" ".env.*.local" "wrangler.toml" ".dev.vars" ".wrangler/")
for file in "${SENSITIVE_FILES[@]}"; do
    if git check-ignore "$file" > /dev/null 2>&1 || git check-ignore -q "**/$file" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓${NC} $file is gitignored"
    else
        echo -e "   ${RED}✗${NC} $file is NOT gitignored!"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Check 2: Verify no sensitive files are staged
echo ""
echo "2️⃣  Checking staged files..."
STAGED_SENSITIVE=$(git diff --cached --name-only | grep -E '\.(env|env\.local|dev\.vars)$|^wrangler\.toml$' || true)
if [ -z "$STAGED_SENSITIVE" ]; then
    echo -e "   ${GREEN}✓${NC} No sensitive files staged"
else
    echo -e "   ${RED}✗${NC} Sensitive files are staged:"
    echo "$STAGED_SENSITIVE" | sed 's/^/     /'
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 3: Verify no sensitive files in git history
echo ""
echo "3️⃣  Checking git history..."
HISTORY_CHECK=$(git log --all --full-history --pretty=format: --name-only -- .env .env.local .dev.vars wrangler.toml 2>/dev/null | sort -u | grep -v '^$' || true)
if [ -z "$HISTORY_CHECK" ]; then
    echo -e "   ${GREEN}✓${NC} No sensitive files in git history"
else
    echo -e "   ${YELLOW}⚠${NC} Found sensitive files in git history:"
    echo "$HISTORY_CHECK" | sed 's/^/     /'
    echo -e "   ${YELLOW}⚠${NC} Consider using git-filter-repo to remove them"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 4: Scan tracked files for API keys
echo ""
echo "4️⃣  Scanning tracked files for secrets..."
if npm run check:secrets > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓${NC} No secrets found in tracked files"
else
    echo -e "   ${RED}✗${NC} Potential secrets found in tracked files"
    npm run check:secrets
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 5: Verify example files don't contain real secrets
echo ""
echo "5️⃣  Checking example files..."
if [ -f ".env.example" ]; then
    if grep -qE '[A-Z0-9]{32,}' .env.example; then
        echo -e "   ${YELLOW}⚠${NC} .env.example may contain real API keys"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "   ${GREEN}✓${NC} .env.example looks safe"
    fi
fi

if [ -f "wrangler.toml.example" ]; then
    if grep -qE 'id = "[a-f0-9]{32}"' wrangler.toml.example; then
        echo -e "   ${YELLOW}⚠${NC} wrangler.toml.example may contain real IDs"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "   ${GREEN}✓${NC} wrangler.toml.example looks safe"
    fi
fi

# Check 6: Verify sensitive data locations
echo ""
echo "6️⃣  Verifying sensitive data locations..."
echo -e "   ${GREEN}✓${NC} Secrets should be in:"
echo "     - .env.local (local dev)"
echo "     - Cloudflare Pages Environment Variables (production)"
echo "     - GitHub Secrets (CI/CD)"
echo ""
echo -e "   ${RED}✗${NC} Secrets should NEVER be in:"
echo "     - Git repository"
echo "     - .env.example"
echo "     - wrangler.toml.example"
echo "     - README.md or docs"
echo "     - Source code files"

# Summary
echo ""
echo "=============================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ Security audit passed!${NC}"
    echo ""
    echo "Safe to commit and push to GitHub."
    exit 0
else
    echo -e "${RED}❌ Security audit failed!${NC}"
    echo ""
    echo "Found $ISSUES_FOUND issue(s). Fix them before committing."
    echo ""
    echo "To fix:"
    echo "1. Remove sensitive files from staging: git reset HEAD <file>"
    echo "2. Ensure .gitignore includes all sensitive patterns"
    echo "3. If secrets are in history, use: git filter-repo --path <file> --invert-paths"
    exit 1
fi
