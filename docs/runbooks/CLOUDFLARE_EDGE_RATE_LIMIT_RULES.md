# Cloudflare Edge Rate-Limit Rules (Oracle Routes)

## Purpose

Add a low-complexity outer protection wall before app code executes, so abusive spikes do not burn free-tier function/provider budget.

This runbook covers **Step 1 only**:
- edge rate-limit rules on oracle routes.

Step 2 (Durable Object global limiter) is intentionally deferred for local confirmation.

## Rule Targets

Apply rules to `POST` requests only:
- `/api/oracle/fetch-tx`
- `/api/oracle/verify-signature`

## Recommended Starting Limits

Use these as conservative defaults (tune later from analytics):

1. `fetch-tx` rule
   - Expression: `http.request.method eq "POST" and http.request.uri.path eq "/api/oracle/fetch-tx"`
   - Characteristic: IP
   - Requests per period: `20`
   - Period: `1 minute`
   - Mitigation timeout: `60 seconds`
   - Action rollout:
     - Start with `Managed Challenge` for first rollout window.
     - Move to `Block` after false-positive check.

2. `verify-signature` rule
   - Expression: `http.request.method eq "POST" and http.request.uri.path eq "/api/oracle/verify-signature"`
   - Characteristic: IP
   - Requests per period: `60`
   - Period: `1 minute`
   - Mitigation timeout: `60 seconds`
   - Action rollout:
     - Start with `Managed Challenge` for first rollout window.
     - Move to `Block` after false-positive check.

## Dashboard Setup

1. Open Cloudflare Dashboard for the production zone.
2. Go to `Security` -> `WAF` -> `Rate limiting rules`.
3. Create the two rules above.
4. Deploy with `Managed Challenge` first.
5. Observe analytics/logs during real traffic window.
6. Promote each rule to `Block` if no legitimate-user breakage appears.

## Verification Checklist

- Confirm both rules are enabled in production.
- Trigger controlled bursts from a test IP and confirm mitigation is applied.
- Confirm normal user flow (`1-3` receipt attempts) is unaffected.
- Confirm origin app logs show reduced abusive burst traffic.

## Rollback-Safe Operation

Use the rule enable/disable toggle as the rollback flag:

- Fast rollback: disable only the affected rule.
- Safer rollback: switch action from `Block` back to `Managed Challenge`.
- Full rollback: disable both rules and rely on existing in-app route limits.

No application code rollback is required for this step.

If testing Durable Object limiter paths later:
- Do not disable edge rules during the experiment.
- Roll back the in-app backend mode first (`durable_*` -> `legacy`) before changing edge protections.

## Notes and Uncertainty

- Thresholds above are starting points, not absolutes.
- If you see false positives (shared office/mobile carrier IPs), raise per-IP limits before disabling protections entirely.
- Keep in-app route limits active even with edge rules enabled; layers are complementary.
