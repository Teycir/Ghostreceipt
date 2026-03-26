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
declare -a blockcypher_keys=()
declare -a missing_required_env=()
declare -A seen_etherscan=()
declare -A seen_helius=()
declare -A seen_blockcypher=()

REQUIRED_ENDPOINT_URL_VARS=(
    "BITCOIN_PUBLIC_RPC_MEMPOOL_SPACE_MAINNET_URL"
    "BITCOIN_PUBLIC_RPC_MEMPOOL_EMZY_MAINNET_URL"
    "BITCOIN_PUBLIC_RPC_MEMPOOL_NINJA_MAINNET_URL"
    "BITCOIN_PROVIDER_BLOCKCYPHER_MAINNET_URL"
    "ETHEREUM_PUBLIC_RPC_PUBLICNODE_PRIMARY_URL"
    "ETHEREUM_PUBLIC_RPC_PUBLICNODE_SECONDARY_URL"
    "ETHEREUM_PUBLIC_RPC_FLASHBOTS_URL"
    "ETHEREUM_PUBLIC_RPC_CLOUDFLARE_URL"
    "ETHEREUM_PROVIDER_ETHERSCAN_V2_MAINNET_URL"
    "SOLANA_PUBLIC_RPC_MAINNET_BETA_PRIMARY_URL"
    "SOLANA_PUBLIC_RPC_PUBLICNODE_URL"
    "SOLANA_PROVIDER_HELIUS_MAINNET_URL"
)

OPTIONAL_SERVER_CONFIG_VARS=(
    "ETHEREUM_PUBLIC_RPC_NAMES"
    "ETHEREUM_USDC_PUBLIC_RPC_NAMES"
    "SOLANA_PUBLIC_RPC_NAMES"
    "BITCOIN_PUBLIC_RPC_NAMES"
    "ETHEREUM_PUBLIC_RPC_NAME"
    "ETHEREUM_USDC_PUBLIC_RPC_NAME"
    "SOLANA_PUBLIC_RPC_NAME"
    "BITCOIN_PUBLIC_RPC_NAME"
    "ETHEREUM_PUBLIC_RPC_URLS"
    "ETHEREUM_USDC_PUBLIC_RPC_URLS"
    "SOLANA_PUBLIC_RPC_URLS"
    "BITCOIN_PUBLIC_RPC_URLS"
    "ETHEREUM_PUBLIC_RPC_URL"
    "SOLANA_PUBLIC_RPC_URL"
    "ORACLE_VALIDATE_CONFIG_ON_LOAD"
    "ORACLE_BTC_CONSENSUS_MODE"
    "ORACLE_ETH_CONSENSUS_MODE"
    "ORACLE_SOL_CONSENSUS_MODE"
    "TRUST_PROXY_HEADERS"
)

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

add_blockcypher_key() {
    local value="$1"
    if [ -z "$value" ]; then
        return
    fi

    if [ -n "${seen_blockcypher[$value]:-}" ]; then
        return
    fi

    seen_blockcypher["$value"]=1
    blockcypher_keys+=("$value")
}

collect_etherscan_keys() {
    add_etherscan_key "${ETHERSCAN_API_KEY:-}"
    for i in 1 2 3 4 5 6; do
        var_name="ETHERSCAN_API_KEY_${i}"
        add_etherscan_key "${!var_name:-}"
    done

    while IFS= read -r var_name; do
        if [[ "$var_name" =~ ^ETHERSCAN_API_KEY_[0-9]+$ ]]; then
            continue
        fi
        add_etherscan_key "${!var_name:-}"
    done < <(compgen -A variable ETHERSCAN_API_KEY_ | sort)
}

collect_helius_keys() {
    add_helius_key "${HELIUS_API_KEY:-}"
    for i in 1 2 3 4 5 6; do
        var_name="HELIUS_API_KEY_${i}"
        add_helius_key "${!var_name:-}"
    done

    while IFS= read -r var_name; do
        if [[ "$var_name" =~ ^HELIUS_API_KEY_[0-9]+$ ]]; then
            continue
        fi
        add_helius_key "${!var_name:-}"
    done < <(compgen -A variable HELIUS_API_KEY_ | sort)
}

collect_blockcypher_keys() {
    add_blockcypher_key "${BLOCKCYPHER_API_TOKEN:-}"
    for i in 1 2 3 4 5 6; do
        var_name="BLOCKCYPHER_API_TOKEN_${i}"
        add_blockcypher_key "${!var_name:-}"
    done

    add_blockcypher_key "${BLOCKCYPHER_API_KEY:-}"
    for i in 1 2 3 4 5 6; do
        var_name="BLOCKCYPHER_API_KEY_${i}"
        add_blockcypher_key "${!var_name:-}"
    done

    while IFS= read -r var_name; do
        if [[ "$var_name" =~ ^BLOCKCYPHER_API_TOKEN_[0-9]+$ || "$var_name" =~ ^BLOCKCYPHER_API_KEY_[0-9]+$ ]]; then
            continue
        fi
        add_blockcypher_key "${!var_name:-}"
    done < <(compgen -A variable BLOCKCYPHER_API_TOKEN_ | sort)

    while IFS= read -r var_name; do
        if [[ "$var_name" =~ ^BLOCKCYPHER_API_TOKEN_[0-9]+$ || "$var_name" =~ ^BLOCKCYPHER_API_KEY_[0-9]+$ ]]; then
            continue
        fi
        add_blockcypher_key "${!var_name:-}"
    done < <(compgen -A variable BLOCKCYPHER_API_KEY_ | sort)
}

collect_etherscan_keys
collect_helius_keys
collect_blockcypher_keys

if [ -z "${ORACLE_PRIVATE_KEY:-}" ]; then
    missing_required_env+=("ORACLE_PRIVATE_KEY")
fi

for var_name in "${REQUIRED_ENDPOINT_URL_VARS[@]}"; do
    if [ -z "${!var_name:-}" ]; then
        missing_required_env+=("$var_name")
    fi
done

if [ "${#etherscan_keys[@]}" -eq 0 ]; then
    missing_required_env+=("ETHERSCAN_API_KEY (or ETHERSCAN_API_KEY_1..N)")
fi

if [ "${#helius_keys[@]}" -eq 0 ]; then
    missing_required_env+=("HELIUS_API_KEY (or HELIUS_API_KEY_1..N)")
fi

if [ "${#blockcypher_keys[@]}" -eq 0 ]; then
    missing_required_env+=("BLOCKCYPHER_API_TOKEN (or BLOCKCYPHER_API_TOKEN_1..N)")
fi

if [ "${#missing_required_env[@]}" -gt 0 ]; then
    echo "❌ Missing required runtime config in .env.local:"
    for missing_var in "${missing_required_env[@]}"; do
        echo "   - $missing_var"
    done
    echo ""
    echo "Set the missing values above, then re-run scripts/sync-secrets.sh."
    exit 1
fi

# Oracle key (must be explicit; do not silently rotate runtime signing identity)
put_secret "ORACLE_PRIVATE_KEY" "$ORACLE_PRIVATE_KEY"
echo "✓ ORACLE_PRIVATE_KEY"
SECRETS_SET=$((SECRETS_SET + 1))

echo ""
echo "🌐 Syncing required provider/public RPC endpoint URLs:"
for var_name in "${REQUIRED_ENDPOINT_URL_VARS[@]}"; do
    put_secret "$var_name" "${!var_name}"
    echo "✓ $var_name"
    SECRETS_SET=$((SECRETS_SET + 1))
done

echo ""
echo "⚙️  Syncing optional server runtime config (if set):"
for var_name in "${OPTIONAL_SERVER_CONFIG_VARS[@]}"; do
    if [ -n "${!var_name:-}" ]; then
        put_secret "$var_name" "${!var_name}"
        echo "✓ $var_name"
        SECRETS_SET=$((SECRETS_SET + 1))
    fi
done

if [ "${#etherscan_keys[@]}" -eq 0 ]; then
    echo "❌ No Etherscan API keys found in .env.local"
    exit 1
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

if [ "${#helius_keys[@]}" -eq 0 ]; then
    echo "❌ No Helius API keys found in .env.local"
    exit 1
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

if [ "${#blockcypher_keys[@]}" -eq 0 ]; then
    echo "❌ No BlockCypher API keys found in .env.local"
    exit 1
else
    # Primary key
    put_secret "BLOCKCYPHER_API_TOKEN" "${blockcypher_keys[0]}"
    echo "✓ BLOCKCYPHER_API_TOKEN"
    SECRETS_SET=$((SECRETS_SET + 1))

    # Fallback keys (populate _1 through _6 from remaining keys)
    for i in 1 2 3 4 5 6; do
        index="$i"
        if [ "$index" -lt "${#blockcypher_keys[@]}" ]; then
            secret_name="BLOCKCYPHER_API_TOKEN_${i}"
            put_secret "$secret_name" "${blockcypher_keys[$index]}"
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
