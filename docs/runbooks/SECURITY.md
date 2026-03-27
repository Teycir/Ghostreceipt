# Security Runbook

This runbook defines how GhostReceipt handles secrets, oracle keys, and production security controls.

## Secret Handling

Never commit real secrets.

Sensitive files/values:
- `.env.local`, `.env.*.local`, `.dev.vars`
- Provider keys/tokens (`ETHERSCAN_*`, `HELIUS_*`, `BLOCKCYPHER_*`)
- `ORACLE_PRIVATE_KEY`

Tracked files that are safe to commit:
- `wrangler.toml` (project config + D1 binding metadata)
- `wrangler.toml.example`

## Local Setup

1. Copy runtime template:

```bash
cp .env.example .env.local
```

2. Fill required values in `.env.local`.

3. Validate before deploy:

```bash
npm run deploy:check
```

## Cloudflare Secrets Sync (Recommended)

Use the strict sync script instead of manual one-by-one secret commands.

```bash
npm run cf:sync
```

This sync path is fail-fast for missing required runtime keys and endpoint URL variables.

## Oracle Key Management

- Keep oracle private key only in secret stores (`.env.local` locally, Cloudflare Pages secrets in hosted envs).
- Rotate on compromise suspicion, maintainer offboarding, or scheduled cadence.
- Keep transparency log updated during key rotations:
  - `config/oracle/transparency-log.json`

Validation command:

```bash
npm run check:oracle-transparency-log
```

## Rotation Checklist

1. Generate new key:

```bash
openssl rand -hex 32
```

2. Update `.env.local` and re-sync:

```bash
npm run cf:sync
```

3. Update transparency log entry and run validation.
4. Redeploy production.
5. Verify newly generated receipts pass `/api/oracle/verify-signature`.

## Runtime Protection Layers

- In-app route limits for oracle endpoints.
- Cloudflare edge WAF rate-limit rules for:
  - `POST /api/oracle/fetch-tx`
  - `POST /api/oracle/verify-signature`
- Primary-first client routing with optional backup only on transport/platform failures.

Related guide:
- [CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md](./CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md)

## Incident Response (Secret Exposure)

1. Rotate exposed key(s) immediately.
2. Re-sync secrets (`npm run cf:sync`) and redeploy.
3. Verify oracle signature path and generation flow.
4. Document incident window and remediation.

## Continuous Checks

Run before release:

```bash
npm run check:secrets
npm run deploy:check
```

## References

- Cloudflare Pages security model: https://developers.cloudflare.com/pages/
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
