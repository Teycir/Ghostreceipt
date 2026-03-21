#!/bin/bash

# Check for accidentally committed secrets
# Exit with error if any secrets are found

echo "🔍 Checking for exposed secrets..."

# Patterns to search for
PATTERNS=(
  "sk_live_"
  "pk_live_"
  "api_key.*=.*[a-zA-Z0-9]{20,}"
  "ETHERSCAN_API_KEY.*=.*[A-Z0-9]{34}"
  "ORACLE_PRIVATE_KEY.*=.*[a-f0-9]{64}"
  "-----BEGIN PRIVATE KEY-----"
  "-----BEGIN RSA PRIVATE KEY-----"
)

# Directories to exclude
EXCLUDE_DIRS=(
  "node_modules"
  ".next"
  ".git"
  "coverage"
  "dist"
  "out"
  "docs"
  "scripts"
  ".github"
)

# Build exclude arguments
EXCLUDE_ARGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$dir"
done

# Check each pattern
FOUND_SECRETS=0
for pattern in "${PATTERNS[@]}"; do
  if grep -r -E "$pattern" $EXCLUDE_ARGS . 2>/dev/null; then
    echo "❌ Found potential secret matching pattern: $pattern"
    FOUND_SECRETS=1
  fi
done

if [ $FOUND_SECRETS -eq 1 ]; then
  echo ""
  echo "❌ SECRETS DETECTED! Do not commit these files."
  echo "   Review the matches above and remove sensitive data."
  exit 1
else
  echo "✅ No secrets detected"
  exit 0
fi
