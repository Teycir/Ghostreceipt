#!/bin/bash
# Manage Cloudflare Pages secrets for GhostReceipt

set -e

PROJECT_NAME="ghostreceipt"
WRANGLER_CWD="${WRANGLER_CWD:-/tmp}"

wrangler_auth() {
    npx wrangler --cwd "$WRANGLER_CWD" "$@"
}

wrangler_pages() {
    npx wrangler "$@"
}

echo "🔐 GhostReceipt Secret Management"
echo "=================================="
echo ""

# Check if logged in
if ! wrangler_auth whoami &>/dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo "Run: npx wrangler login"
    exit 1
fi

show_menu() {
    echo "Select an option:"
    echo "1) Set all required secrets"
    echo "2) Set ORACLE_PRIVATE_KEY"
    echo "3) Set ETHERSCAN_API_KEY"
    echo "4) Set fallback Etherscan keys"
    echo "5) Set HELIUS_API_KEY"
    echo "6) Set fallback Helius keys"
    echo "7) Set BLOCKCYPHER_API_TOKEN"
    echo "8) Set fallback BlockCypher keys"
    echo "9) List all secrets"
    echo "10) Delete a secret"
    echo "11) Exit"
    echo ""
    read -p "Choice: " choice
    echo ""
}

set_oracle_key() {
    echo "🔑 Setting ORACLE_PRIVATE_KEY"
    echo ""
    read -p "Generate new key? (y/n): " generate
    
    if [ "$generate" = "y" ]; then
        ORACLE_KEY=$(openssl rand -hex 32)
        echo "Generated: $ORACLE_KEY"
        echo "⚠️  Save this key securely!"
        echo ""
        echo "$ORACLE_KEY" | wrangler_pages pages secret put ORACLE_PRIVATE_KEY --project-name=$PROJECT_NAME
    else
        read -sp "Enter ORACLE_PRIVATE_KEY: " key
        echo ""
        echo "$key" | wrangler_pages pages secret put ORACLE_PRIVATE_KEY --project-name=$PROJECT_NAME
    fi
    
    echo "✅ ORACLE_PRIVATE_KEY set"
    echo ""
}

set_etherscan_key() {
    echo "🔑 Setting ETHERSCAN_API_KEY"
    echo ""
    read -p "Enter ETHERSCAN_API_KEY: " key
    echo "$key" | wrangler_pages pages secret put ETHERSCAN_API_KEY --project-name=$PROJECT_NAME
    echo "✅ ETHERSCAN_API_KEY set"
    echo ""
}

set_fallback_keys() {
    echo "🔑 Setting fallback Etherscan keys"
    echo ""
    
    read -p "Enter ETHERSCAN_API_KEY_1 (or press Enter to skip): " key1
    if [ -n "$key1" ]; then
        echo "$key1" | wrangler_pages pages secret put ETHERSCAN_API_KEY_1 --project-name=$PROJECT_NAME
        echo "✅ ETHERSCAN_API_KEY_1 set"
    fi

    read -p "Enter ETHERSCAN_API_KEY_2 (or press Enter to skip): " key2
    if [ -n "$key2" ]; then
        echo "$key2" | wrangler_pages pages secret put ETHERSCAN_API_KEY_2 --project-name=$PROJECT_NAME
        echo "✅ ETHERSCAN_API_KEY_2 set"
    fi
    
    read -p "Enter ETHERSCAN_API_KEY_3 (or press Enter to skip): " key3
    if [ -n "$key3" ]; then
        echo "$key3" | wrangler_pages pages secret put ETHERSCAN_API_KEY_3 --project-name=$PROJECT_NAME
        echo "✅ ETHERSCAN_API_KEY_3 set"
    fi
    
    read -p "Enter ETHERSCAN_API_KEY_4 (or press Enter to skip): " key4
    if [ -n "$key4" ]; then
        echo "$key4" | wrangler_pages pages secret put ETHERSCAN_API_KEY_4 --project-name=$PROJECT_NAME
        echo "✅ ETHERSCAN_API_KEY_4 set"
    fi

    read -p "Enter ETHERSCAN_API_KEY_5 (or press Enter to skip): " key5
    if [ -n "$key5" ]; then
        echo "$key5" | wrangler_pages pages secret put ETHERSCAN_API_KEY_5 --project-name=$PROJECT_NAME
        echo "✅ ETHERSCAN_API_KEY_5 set"
    fi

    read -p "Enter ETHERSCAN_API_KEY_6 (or press Enter to skip): " key6
    if [ -n "$key6" ]; then
        echo "$key6" | wrangler_pages pages secret put ETHERSCAN_API_KEY_6 --project-name=$PROJECT_NAME
        echo "✅ ETHERSCAN_API_KEY_6 set"
    fi
    
    echo ""
}

set_helius_key() {
    echo "🔑 Setting HELIUS_API_KEY"
    echo ""
    read -p "Enter HELIUS_API_KEY: " key
    echo "$key" | wrangler_pages pages secret put HELIUS_API_KEY --project-name=$PROJECT_NAME
    echo "✅ HELIUS_API_KEY set"
    echo ""
}

set_fallback_helius_keys() {
    echo "🔑 Setting fallback Helius keys"
    echo ""

    read -p "Enter HELIUS_API_KEY_1 (or press Enter to skip): " key1
    if [ -n "$key1" ]; then
        echo "$key1" | wrangler_pages pages secret put HELIUS_API_KEY_1 --project-name=$PROJECT_NAME
        echo "✅ HELIUS_API_KEY_1 set"
    fi

    read -p "Enter HELIUS_API_KEY_2 (or press Enter to skip): " key2
    if [ -n "$key2" ]; then
        echo "$key2" | wrangler_pages pages secret put HELIUS_API_KEY_2 --project-name=$PROJECT_NAME
        echo "✅ HELIUS_API_KEY_2 set"
    fi

    read -p "Enter HELIUS_API_KEY_3 (or press Enter to skip): " key3
    if [ -n "$key3" ]; then
        echo "$key3" | wrangler_pages pages secret put HELIUS_API_KEY_3 --project-name=$PROJECT_NAME
        echo "✅ HELIUS_API_KEY_3 set"
    fi

    read -p "Enter HELIUS_API_KEY_4 (or press Enter to skip): " key4
    if [ -n "$key4" ]; then
        echo "$key4" | wrangler_pages pages secret put HELIUS_API_KEY_4 --project-name=$PROJECT_NAME
        echo "✅ HELIUS_API_KEY_4 set"
    fi

    read -p "Enter HELIUS_API_KEY_5 (or press Enter to skip): " key5
    if [ -n "$key5" ]; then
        echo "$key5" | wrangler_pages pages secret put HELIUS_API_KEY_5 --project-name=$PROJECT_NAME
        echo "✅ HELIUS_API_KEY_5 set"
    fi

    read -p "Enter HELIUS_API_KEY_6 (or press Enter to skip): " key6
    if [ -n "$key6" ]; then
        echo "$key6" | wrangler_pages pages secret put HELIUS_API_KEY_6 --project-name=$PROJECT_NAME
        echo "✅ HELIUS_API_KEY_6 set"
    fi

    echo ""
}

set_blockcypher_key() {
    echo "🔑 Setting BLOCKCYPHER_API_TOKEN"
    echo ""
    read -p "Enter BLOCKCYPHER_API_TOKEN: " key
    echo "$key" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN --project-name=$PROJECT_NAME
    echo "✅ BLOCKCYPHER_API_TOKEN set"
    echo ""
}

set_fallback_blockcypher_keys() {
    echo "🔑 Setting fallback BlockCypher keys"
    echo ""

    read -p "Enter BLOCKCYPHER_API_TOKEN_1 (or press Enter to skip): " key1
    if [ -n "$key1" ]; then
        echo "$key1" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN_1 --project-name=$PROJECT_NAME
        echo "✅ BLOCKCYPHER_API_TOKEN_1 set"
    fi

    read -p "Enter BLOCKCYPHER_API_TOKEN_2 (or press Enter to skip): " key2
    if [ -n "$key2" ]; then
        echo "$key2" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN_2 --project-name=$PROJECT_NAME
        echo "✅ BLOCKCYPHER_API_TOKEN_2 set"
    fi

    read -p "Enter BLOCKCYPHER_API_TOKEN_3 (or press Enter to skip): " key3
    if [ -n "$key3" ]; then
        echo "$key3" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN_3 --project-name=$PROJECT_NAME
        echo "✅ BLOCKCYPHER_API_TOKEN_3 set"
    fi

    read -p "Enter BLOCKCYPHER_API_TOKEN_4 (or press Enter to skip): " key4
    if [ -n "$key4" ]; then
        echo "$key4" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN_4 --project-name=$PROJECT_NAME
        echo "✅ BLOCKCYPHER_API_TOKEN_4 set"
    fi

    read -p "Enter BLOCKCYPHER_API_TOKEN_5 (or press Enter to skip): " key5
    if [ -n "$key5" ]; then
        echo "$key5" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN_5 --project-name=$PROJECT_NAME
        echo "✅ BLOCKCYPHER_API_TOKEN_5 set"
    fi

    read -p "Enter BLOCKCYPHER_API_TOKEN_6 (or press Enter to skip): " key6
    if [ -n "$key6" ]; then
        echo "$key6" | wrangler_pages pages secret put BLOCKCYPHER_API_TOKEN_6 --project-name=$PROJECT_NAME
        echo "✅ BLOCKCYPHER_API_TOKEN_6 set"
    fi

    echo ""
}

list_secrets() {
    echo "📋 Current secrets:"
    echo ""
    wrangler_pages pages secret list --project-name=$PROJECT_NAME
    echo ""
}

delete_secret() {
    echo "🗑️  Delete secret"
    echo ""
    read -p "Enter secret name to delete: " secret_name
    wrangler_pages pages secret delete "$secret_name" --project-name=$PROJECT_NAME
    echo "✅ Secret deleted"
    echo ""
}

set_all_secrets() {
    echo "🔑 Setting all required secrets"
    echo ""
    
    set_oracle_key
    set_etherscan_key
    set_helius_key
    set_blockcypher_key

    read -p "Add fallback Etherscan keys? (y/n): " add_fallback
    if [ "$add_fallback" = "y" ]; then
        set_fallback_keys
    fi

    read -p "Add fallback Helius keys? (y/n): " add_helius_fallback
    if [ "$add_helius_fallback" = "y" ]; then
        set_fallback_helius_keys
    fi

    read -p "Add fallback BlockCypher keys? (y/n): " add_blockcypher_fallback
    if [ "$add_blockcypher_fallback" = "y" ]; then
        set_fallback_blockcypher_keys
    fi
    
    echo "✅ All secrets configured!"
    echo ""
    list_secrets
}

while true; do
    show_menu
    
    case $choice in
        1)
            set_all_secrets
            ;;
        2)
            set_oracle_key
            ;;
        3)
            set_etherscan_key
            ;;
        4)
            set_fallback_keys
            ;;
        5)
            set_helius_key
            ;;
        6)
            set_fallback_helius_keys
            ;;
        7)
            set_blockcypher_key
            ;;
        8)
            set_fallback_blockcypher_keys
            ;;
        9)
            list_secrets
            ;;
        10)
            delete_secret
            ;;
        11)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice"
            echo ""
            ;;
    esac
done
