# Manual Testing Guide (Step-by-Step)

Use this runbook for human QA before deployment, after major feature changes, or when triaging user-reported issues.

## Scope

This checklist validates:
- generator flow,
- verification flow,
- static docs flow,
- fail-safe routing expectations,
- basic UX behavior across desktop/mobile.

## Prerequisites

1. Node `>=20.9.0` and npm `>=9`.
2. Dependencies installed:
```bash
npm ci
```
3. Local environment configured:
```bash
cp .env.example .env.local
```
4. Required keys set in `.env.local`:
- `ORACLE_PRIVATE_KEY`
- at least one Ethereum provider key (`ETHERSCAN_API_KEY`)
- at least one Solana provider key (`HELIUS_API_KEY`)

## Live Reproduction Data (Real On-Chain)

Use real transaction data verified against production API (`https://ghostreceipt.pages.dev`) as of `2026-03-27`:

- BTC:
  - `d07422d13247b8f59bddd9ea53f8ccbd0f6a14e6f666eb3dde703c7db4fd1f58`
  - Explorer: `https://mempool.space/tx/d07422d13247b8f59bddd9ea53f8ccbd0f6a14e6f666eb3dde703c7db4fd1f58`
- ETH (native):
  - `0x07f38e681d32e36213e575b25a5f6367ac2fee9eb3c3976d9651ec0786c8ca42`
  - Explorer: `https://etherscan.io/tx/0x07f38e681d32e36213e575b25a5f6367ac2fee9eb3c3976d9651ec0786c8ca42`
- ETH (USDC):
  - `0x49f81b3603bda9461ce92925666c215442ed48f53e62ea8b066f3e46d828213c`
  - Explorer: `https://etherscan.io/tx/0x49f81b3603bda9461ce92925666c215442ed48f53e62ea8b066f3e46d828213c`
- SOL:
  - `4AotthQtPNPMenWxNHr9QGaPh8moLAwX4bRMdbi8sezPW5N3vesV9HUDFYo9kH3anGgLNZTtPYDxpKfq7e58o5zs`
  - Explorer: `https://solscan.io/tx/4AotthQtPNPMenWxNHr9QGaPh8moLAwX4bRMdbi8sezPW5N3vesV9HUDFYo9kH3anGgLNZTtPYDxpKfq7e58o5zs`

For claim inputs, start with conservative values:
- Claimed amount: `1`
- Minimum date: a historical date well before the tx date (for example `2020-01-01`).

For explicit bound checks per transaction:
- Positive amount check: set claimed/minimum amount equal to the fetched on-chain amount.
- Negative amount check: set claimed/minimum amount to fetched amount + `1`.
- Positive date check: set minimum date equal to the fetched transaction date.
- Negative date check: set minimum date to one day after the fetched transaction date.

If a hash becomes unavailable over time, replace with current real tx values in:
- `.env.local`:
  - `LIVE_BTC_TX_HASH`
  - `LIVE_ETH_TX_HASH`
  - `LIVE_ETH_USDC_TX_HASH`
  - `LIVE_SOL_TX_SIGNATURE`

## Test Environment Setup

1. Start app locally:
```bash
npm run dev
```
2. Open:
- `http://localhost:3000`

## Step-by-Step Manual Tests

## 1) Home Page Smoke

1. Open `/`.
2. Confirm primary UI loads without console errors.
3. Confirm chain selector shows:
- Bitcoin
- Ethereum (ETH)
- Ethereum (USDC)
- Solana (SOL)

Expected:
- no runtime crash,
- form is interactive.

## 2) Happy Path: Generate BTC Receipt

1. Chain: `Bitcoin`.
2. Paste BTC hash from this runbook.
3. Claimed amount: `1`.
4. Minimum date: `2020-01-01`.
5. Click `Generate Receipt`.

Expected:
- loading/progress is visible,
- success state appears,
- receipt/share section is rendered,
- validation metadata is present.

## 3) Verify Receipt Link

1. From success state, open verification link (or copy + open in a new tab).
2. Confirm `/verify` page loads parsed proof payload.
3. Run verification action (if action is explicit in UI).

Expected:
- result shows `valid` / verified state,
- no schema/parsing errors.

## 4) History Persistence

1. Generate at least one receipt.
2. Open `/history`.
3. Refresh browser.

Expected:
- generated receipt entry is listed,
- entry persists after refresh (local history behavior).

## 5) Negative Test: Invalid Hash

1. Chain: `Bitcoin`.
2. Enter invalid hash (for example `abc123`).
3. Attempt generation.

Expected:
- request is rejected with clear validation error,
- no success card is shown.

## 6) Static Docs Check

1. Open:
- `/docs/how-to-use.html`
- `/docs/faq.html`
- `/docs/security.html`
- `/docs/license.html`
2. Confirm favicon appears.
3. Confirm footer links work and no broken layout.

Expected:
- pages render correctly on desktop and mobile width,
- no stale/broken content blocks.

## 7) Fail-Safe Policy Spot Check

Use automated drill as manual operator confirmation:

```bash
npm run test:drill:oracle-failover
```

Expected:
- drill passes,
- fallback triggers on primary `503`/network failure,
- fallback does not trigger on `429`.

## 8) Real Live Reproduction (CLI)

Run end-to-end live checks with real provider calls:

```bash
npm run test:live:oracle
npm run test:live:speed:legacy-vs-edge
npm run test:live:speed:matrix
```

Expected:
- live suites pass with real on-chain data,
- speed outputs print legacy vs edge summaries,
- no schema or signature verification regressions.

## 9) Build + Quality Gate

Run the same core checks expected by CI:

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run test:perf:proof
npm run test:stress:oracle
npm run build
```

Expected:
- all commands pass,
- build completes,
- only non-blocking warnings (if any) are acceptable.

## 10) Mobile Sanity

1. Open browser devtools responsive mode (for example iPhone 12 width).
2. Repeat quick pass of sections 1, 2, and 6.

Expected:
- form remains usable,
- no clipped primary buttons,
- static docs remain readable.

## Sign-Off Template

Record this after each manual cycle:

- Date:
- Tester:
- Environment: local / preview / production
- Commit SHA:
- Result: PASS / FAIL
- Notes:
- Follow-ups:
