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
- `.next/` (build artifacts)
- `*.tsbuildinfo` (TypeScript cache)
- `.cache/` (various caches)
- `.eslintcache`

`package-lock.json` is intentionally tracked and should be reviewed in pull requests.

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

## Oracle Key Management Policy

This project currently operates a centralized oracle signing key for canonical tx fact attestations.

### Key Custody
- The oracle private key must exist only in secret stores (`.env.local` for local dev, deployment secret manager for hosted envs).
- If running verification in an isolated environment, prefer `ORACLE_PUBLIC_KEY` without private key access.
- Never place oracle private key material in source files, commit history, issue trackers, screenshots, or CI logs.
- Limit write access to production secret stores to a minimal maintainer set.

### Rotation Cadence
- Scheduled rotation: every 90 days.
- Immediate rotation triggers:
  - suspected key leak or accidental exposure,
  - maintainer access change/offboarding,
  - unexplained signature verification anomalies.

### Rotation Procedure (High-Level)
1. Generate a new key with `openssl rand -hex 32`.
2. Deploy updated secret to all environments.
3. Redeploy oracle API.
4. Verify signatures on newly issued payloads.
5. Archive a short provenance note (date, operator, reason, impacted environments).

### Verification Endpoint Usage
- The verifier path checks oracle-authenticated payloads via `POST /api/oracle/verify-signature`.
- Oracle signatures are Ed25519 (`64` bytes, hex-encoded as `128` chars).
- Ensure `oraclePubKeyId` in generated payloads maps to the active key ID after rotation.
- Keep route-level rate limiting enabled for this endpoint to reduce probing/oracle abuse risk.

### Runtime Storage Limits (Important)
- Current replay protection and API rate limit stores are in-memory maps.
- In serverless environments (Cloudflare Workers, Vercel functions, etc.), this state is instance-local and ephemeral.
- Consequences:
  - Limits can reset on cold starts.
  - Cross-instance requests can bypass per-instance counters.
- Production guidance:
  - Cloudflare target: move these protections to Durable Objects or KV-backed coordination.
  - Node target: use a shared external store (for example Redis) for distributed rate/replay controls.

### CSP Trade-offs
- Current CSP includes `script-src 'unsafe-eval'` because `snarkjs`/witness tooling requires dynamic evaluation in browser flows.
- Current CSP also includes `script-src 'unsafe-inline'`, which broadens XSS exposure.
- Plan to replace inline allowances with nonce/hash-based scripts when framework/runtime support is finalized for this app path.

### Bitcoin Canonical Value Semantics
- Bitcoin `valueAtomic` currently represents total transaction output value (`sum(vout)` / `output_total`), not recipient-specific net received value.
- This is intentional for the current privacy model (recipient redacted), but must be documented in product/release notes so claim interpretation is unambiguous.

### Incident Response Addendum (Oracle Key Compromise)
1. Rotate `ORACLE_PRIVATE_KEY` immediately in all environments.
2. Revoke any stale deployment credentials used during the incident window.
3. Publish an incident note with exposure window and remediation steps.
4. Re-run a release-readiness checklist before resuming normal issuance.

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
