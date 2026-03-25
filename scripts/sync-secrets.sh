#!/bin/bash
# Sync all secrets from .env.local to Cloudflare Pages

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-ghostreceipt}"
WRANGLER_CWD="${WRANGLER_CWD:-/tmp}"

wrangler_auth() {
    npx wrangler --cwd "$WRANGLER_CWD" "$@"
}

wrangler_pages() {
    npx wrangler "$@"
}

put_secret() {
    local name="$1"
    local value="$2"
    printf '%s' "$value" | wrangler_pages pages secret put "$name" --project-name="$PROJECT_NAME" >/dev/null
}

echo "🔄 Syncing secrets from .env.local to Cloudflare"
echo "================================================="
echo ""

# Check if logged in
if ! wrangler_auth whoami >/dev/null 2>&1; then
    echo "❌ Not logged in to Cloudflare"
    echo "Run: npx wrangler login"
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found"
    echo "Copy .env.example to .env.local and configure your keys"
    exit 1
fi

# Load environment variables from .env.local
set -a
source .env.local
set +a

echo "📋 Syncing discovered secrets:"
echo ""

SECRETS_SET=0
declare -a etherscan_keys=()
declare -a helius_keys=()
declare -A seen_etherscan=()
declare -A seen_helius=()

add_etherscan_key() {
    local value="$1"
    if [ -z "$value" ]; then
        return
    fi

    if [ -n "${seen_etherscan[$value]:-}" ]; then
        return
    fi

    seen_etherscan["$value"]=1
    etherscan_keys+=("$value")
}

add_helius_key() {
    local value="$1"
    if [ -z "$value" ]; then
        return
    fi

    if [ -n "${seen_helius[$value]:-}" ]; then
        return
    fi

    seen_helius["$value"]=1
    helius_keys+=("$value")
}

# Oracle key (generate one if missing locally)
if [ -n "${ORACLE_PRIVATE_KEY:-}" ]; then
    put_secret "ORACLE_PRIVATE_KEY" "$ORACLE_PRIVATE_KEY"
    echo "✓ ORACLE_PRIVATE_KEY"
    SECRETS_SET=$((SECRETS_SET + 1))
else
    GENERATED_ORACLE_KEY="$(openssl rand -hex 32)"
    put_secret "ORACLE_PRIVATE_KEY" "$GENERATED_ORACLE_KEY"
    echo "✓ ORACLE_PRIVATE_KEY (generated because .env.local had none)"
    SECRETS_SET=$((SECRETS_SET + 1))
fi

# Collect canonical Etherscan env vars first
add_etherscan_key "${ETHERSCAN_API_KEY:-}"
for i in 1 2 3 4 5 6; do
    var_name="ETHERSCAN_API_KEY_${i}"
    add_etherscan_key "${!var_name:-}"
done

# Also collect provider-specific aliases (for local key naming conventions)
while IFS= read -r var_name; do
    if [[ "$var_name" =~ ^ETHERSCAN_API_KEY_[0-9]+$ ]]; then
        continue
    fi
    add_etherscan_key "${!var_name:-}"
done < <(compgen -A variable ETHERSCAN_API_KEY_ | sort)

if [ "${#etherscan_keys[@]}" -eq 0 ]; then
    echo "⚠️  No Etherscan API keys found in .env.local"
else
    # Primary key
    put_secret "ETHERSCAN_API_KEY" "${etherscan_keys[0]}"
    echo "✓ ETHERSCAN_API_KEY"
    SECRETS_SET=$((SECRETS_SET + 1))

    # Fallback keys (populate _1 through _6 from remaining keys)
    for i in 1 2 3 4 5 6; do
        index="$i"
        if [ "$index" -lt "${#etherscan_keys[@]}" ]; then
            secret_name="ETHERSCAN_API_KEY_${i}"
            put_secret "$secret_name" "${etherscan_keys[$index]}"
            echo "✓ $secret_name"
            SECRETS_SET=$((SECRETS_SET + 1))
        fi
    done
fi

# Collect canonical Helius env vars first
add_helius_key "${HELIUS_API_KEY:-}"
for i in 1 2 3 4 5 6; do
    var_name="HELIUS_API_KEY_${i}"
    add_helius_key "${!var_name:-}"
done

# Also collect provider-specific aliases (for local key naming conventions)
while IFS= read -r var_name; do
    if [[ "$var_name" =~ ^HELIUS_API_KEY_[0-9]+$ ]]; then
        continue
    fi
    add_helius_key "${!var_name:-}"
done < <(compgen -A variable HELIUS_API_KEY_ | sort)

if [ "${#helius_keys[@]}" -eq 0 ]; then
    echo "⚠️  No Helius API keys found in .env.local"
else
    # Primary key
    put_secret "HELIUS_API_KEY" "${helius_keys[0]}"
    echo "✓ HELIUS_API_KEY"
    SECRETS_SET=$((SECRETS_SET + 1))

    # Fallback keys (populate _1 through _6 from remaining keys)
    for i in 1 2 3 4 5 6; do
        index="$i"
        if [ "$index" -lt "${#helius_keys[@]}" ]; then
            secret_name="HELIUS_API_KEY_${i}"
            put_secret "$secret_name" "${helius_keys[$index]}"
            echo "✓ $secret_name"
            SECRETS_SET=$((SECRETS_SET + 1))
        fi
    done
fi

# Blockchair key
if [ -n "${BLOCKCHAIR_API_KEY:-}" ]; then
    put_secret "BLOCKCHAIR_API_KEY" "$BLOCKCHAIR_API_KEY"
    echo "✓ BLOCKCHAIR_API_KEY"
    SECRETS_SET=$((SECRETS_SET + 1))
fi

echo ""
echo "✅ Synced $SECRETS_SET secrets to Cloudflare"
echo ""
echo "📋 Current secrets on Cloudflare:"
wrangler_pages pages secret list --project-name="$PROJECT_NAME"
echo ""
echo "⚠️  Remember to set public variables in Cloudflare dashboard:"
echo "   - NEXT_PUBLIC_APP_URL"
echo "   - NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE (optional)"
echo "   - TRUST_PROXY_HEADERS"
