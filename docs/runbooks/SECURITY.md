# Security & Sensitive Data Protection

## Sensitive Data Classification

### 🔴 CRITICAL - Never Commit
These files contain secrets and must NEVER be committed to git:

1. **Environment Files**
   - `.env`
   - `.env.local`
   - `.env.*.local`
   - `.dev.vars` (Cloudflare local secrets)

2. **Cloudflare Configuration**
   - `wrangler.toml` (contains account ID and namespace IDs)
   - `.wrangler/` directory (local Cloudflare cache)

3. **API Keys & Secrets**
   - Oracle private keys
   - Etherscan API keys
   - Blockchair API keys
   - Any provider API keys

### 🟡 PROTECTED - Gitignored
These files are automatically excluded:

- `node_modules/`
- `package-lock.json` (can contain dependency vulnerabilities)
- `.next/` (build artifacts)
- `*.tsbuildinfo` (TypeScript cache)
- `.cache/` (various caches)
- `.eslintcache`

## Setup Instructions

### 1. Copy Template Files

```bash
# Copy environment template
cp .env.example .env.local

# Copy Cloudflare config template
cp wrangler.toml.example wrangler.toml
```

### 2. Fill in Secrets

Edit `.env.local`:
```bash
# Oracle signing key (generate with: openssl rand -hex 32)
ORACLE_PRIVATE_KEY=your_generated_key_here

# Etherscan API keys (get from: https://etherscan.io/myapikey)
ETHERSCAN_API_KEY_1=your_primary_key
ETHERSCAN_API_KEY_2=your_fallback_key_1
ETHERSCAN_API_KEY_3=your_fallback_key_2

# Optional: Blockchair API key
BLOCKCHAIR_API_KEY=your_blockchair_key
```

Edit `wrangler.toml`:
```toml
account_id = "8f49c311ff2506c6020f060b8c1da686"  # Your Cloudflare account ID

[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"  # From: wrangler kv:namespace create CACHE
```

### 3. Set Cloudflare Secrets

For production deployment:
```bash
wrangler secret put ORACLE_PRIVATE_KEY --env production
wrangler secret put ETHERSCAN_API_KEY_1 --env production
wrangler secret put ETHERSCAN_API_KEY_2 --env production
wrangler secret put ETHERSCAN_API_KEY_3 --env production
```

## Verification Checklist

Before committing code:

- [ ] No `.env` or `.env.local` files staged
- [ ] No `wrangler.toml` staged (use `wrangler.toml.example` instead)
- [ ] No API keys in code (search for: `sk_`, `pk_`, `api_key`)
- [ ] No hardcoded secrets in source files
- [ ] CI check passes (GitHub Actions checks for secrets)

## CI/CD Secret Detection

Our CI pipeline automatically checks for leaked secrets:

```bash
# Runs on every push/PR
grep -r "sk_live_\|pk_live_\|api_key" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.git .
```

If secrets are found, the build fails.

## Key Rotation

### Oracle Private Key
```bash
# Generate new key
openssl rand -hex 32

# Update in .env.local
ORACLE_PRIVATE_KEY=new_key_here

# Update in Cloudflare
wrangler secret put ORACLE_PRIVATE_KEY --env production
```

### Provider API Keys
```bash
# Update in .env.local
ETHERSCAN_API_KEY_1=new_key_here

# Update in Cloudflare
wrangler secret put ETHERSCAN_API_KEY_1 --env production
```

## Emergency Response

If secrets are accidentally committed:

1. **Immediately rotate all exposed keys**
2. **Remove from git history:**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push (if safe):**
   ```bash
   git push origin --force --all
   ```
4. **Notify team and update documentation**

## Best Practices

1. **Never share secrets via:**
   - Email
   - Slack/Discord
   - Screenshots
   - Public repositories

2. **Use secure channels:**
   - Password managers (1Password, Bitwarden)
   - Encrypted messaging (Signal)
   - Cloudflare secrets (for production)

3. **Regular audits:**
   - Review `.gitignore` monthly
   - Check for exposed secrets quarterly
   - Rotate keys every 6 months

4. **Development workflow:**
   - Use `.env.local` for local dev
   - Use Cloudflare secrets for production
   - Never commit real keys to git

## Monitoring

Check for exposed secrets:
```bash
# Local check
npm run check:secrets

# GitHub Actions check (automatic on push)
```

## References

- [Cloudflare Secrets Management](https://developers.cloudflare.com/workers/configuration/secrets/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
