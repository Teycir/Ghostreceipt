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

Use real transaction data verified in live integration flows (as of 2026-03-25):

- BTC:
  - `470e55fb000d45c1873a88fe7d3ee1f20208be7d7661c2e29300780a50dd6769`
  - Explorer: `https://mempool.space/tx/470e55fb000d45c1873a88fe7d3ee1f20208be7d7661c2e29300780a50dd6769`
- ETH (native):
  - `0xb0cf76e4cdb751093ec1fadd8a790fad6331a3e85be33e30e44108dbc71778ef`
  - Explorer: `https://etherscan.io/tx/0xb0cf76e4cdb751093ec1fadd8a790fad6331a3e85be33e30e44108dbc71778ef`
- ETH (USDC):
  - `0x09180a76aed361c4eeecbf510efdc05fa6314d2f1ff35e33e244da0c7ca31755`
  - Explorer: `https://etherscan.io/tx/0x09180a76aed361c4eeecbf510efdc05fa6314d2f1ff35e33e244da0c7ca31755`
- SOL:
  - `5JrFL9NNVNLV1PvnUbDd9BBCFZBgYACJSZHrKabKd21WR6DppEepK68CNFrM3Hi8FGHeKBXpGVVkUKeQhuvMXGJ1`
  - Explorer: `https://solscan.io/tx/5JrFL9NNVNLV1PvnUbDd9BBCFZBgYACJSZHrKabKd21WR6DppEepK68CNFrM3Hi8FGHeKBXpGVVkUKeQhuvMXGJ1`

For claim inputs, start with conservative values:
- Claimed amount: `1`
- Minimum date: a historical date well before the tx date (for example `2020-01-01`).

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
