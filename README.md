<!-- donation:eth:start -->
<div align="center">

## Support Development

If this project helps your work, support ongoing maintenance and new features.

**ETH Donation Wallet**  
`0x11282eE5726B3370c8B480e321b3B2aA13686582`

<a href="https://etherscan.io/address/0x11282eE5726B3370c8B480e321b3B2aA13686582">
  <img src="publiceth.svg" alt="Ethereum donation QR code" width="220" />
</a>

_Scan the QR code or copy the wallet address above._

</div>
<!-- donation:eth:end -->


<div align="center">

![License](https://img.shields.io/badge/license-MIT-lightgrey?style=for-the-badge)
![Proof](https://img.shields.io/badge/Proof-Zero--Knowledge-111111?style=for-the-badge)
![Hosting](https://img.shields.io/badge/Hosting-No--Card%20Friendly-0f766e?style=for-the-badge)
![UX](https://img.shields.io/badge/UX-Zero%20Friction-1d4ed8?style=for-the-badge)

<img src="assets/ghostreceipt_ascii.svg" alt="GhostReceipt animated banner" width="720" />

**Generate cryptographic payment receipts without exposing sensitive on-chain identity data.**

### _"Prove the payment. Keep the privacy."_

[Roadmap](./ROADMAP.md) | [Plan](./Plan.md) | [Report Bug](https://github.com/teycir/GhostReceipt/issues)

</div>

---

## Table of Contents
- [Overview](#overview)
- [Why GhostReceipt](#why-ghostreceipt)
- [Key Features](#key-features)
- [Use Cases](#use-cases)
- [Architecture](#architecture)
- [API Model](#api-model)
- [Logic Flow](#logic-flow)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [FAQ](#faq)
- [References](#references)
- [Contact](#contact)

## Overview
GhostReceipt is a privacy-first app that lets users prove payment facts (amount and time window) with zero-knowledge proofs while redacting sender, receiver, and tx hash from shared receipts.

Core product goals:
- Zero-friction UX: from tx hash to shareable proof in under 60 seconds
- No forced signup
- No forced API key from users
- No credit card requirement for local dev and default flow

## Why GhostReceipt
Most payment proof flows force one of two bad options:
- Share too much on-chain identity and lose privacy
- Ask users to trust screenshots or opaque claims

GhostReceipt solves this by combining:
- Verifiable oracle-signed canonical tx facts
- Browser-side zk proof generation
- Shareable verification payloads with redacted sensitive data

## Key Features
- Multi-provider tx fetch with automatic cascade failover
- Optional BYOK (advanced), never required for core user flow
- Deterministic proof generation and verification pipeline
- Shareable receipt links + QR export
- Mobile-first UX with progressive disclosure
- Static docs pages linked from footer (`how-to-use`, `faq`, `security`, `canary`, `license`)

## Use Cases
- Freelancers proving milestone payments without revealing wallet graph
- Merchants proving payment completion without exposing customer addresses
- Accounting and compliance teams validating payment evidence safely
- P2P market participants resolving disputes with verifiable receipts
- DAO contributors proving payouts while minimizing on-chain identity leakage

## Architecture
```mermaid
flowchart LR
    U[User] --> G[Generator UI]
    G --> O[Oracle API]
    O --> P1[Provider A]
    O --> P2[Provider B]
    O --> P3[Provider C]
    O --> S[Oracle Signature]
    G --> ZK[Browser ZK Engine]
    S --> ZK
    ZK --> R[Receipt Payload]
    R --> V[Verifier Page]
    V --> OUT[Verified or Counterfeit State]
```

## API Model
GhostReceipt uses four API types so the product stays reliable while keeping UX friction near zero:

1. Public no-key data APIs (default path):
- BTC reads from `mempool.space` first.
- ETH reads from public RPC endpoints via `viem`.
- Used first to keep onboarding keyless and no-card friendly.

2. Managed keyed provider APIs (server-side fallback path):
- For ETH, keyed fallback uses only Etherscan keys provided by project maintainers.
- Current ETH managed key pool is the internal Etherscan set (primary + fallback keys) configured via server env vars.
- Keys are platform-managed in server environment variables and never exposed in client code.
- Multiple managed keys are rotated through a cascade manager for resilience (same pattern as smartcontractpatternfinder).

3. First-party internal Oracle API:
- `POST /api/oracle/fetch-tx` validates input, fetches canonical tx facts, normalizes data, and returns an oracle-signed payload.
- This API is the trust boundary between provider variance and deterministic proof generation.

4. Optional BYOK APIs (advanced mode only):
- Users may add their own provider keys for higher throughput.
- BYOK is optional and never required for receipt generation or verification.
- For non-ETH providers, GhostReceipt uses the same cascade/failover system now and can attach managed keys later as they are provided.

## Logic Flow
```mermaid
sequenceDiagram
    participant User
    participant UI as Generator UI
    participant Oracle as Oracle API
    participant Providers as Chain Providers
    participant ZK as Browser Prover
    participant Verify as Verify Page

    User->>UI: Enter chain + tx hash + claim
    UI->>Oracle: POST /api/oracle/fetch-tx
    Oracle->>Providers: Fetch canonical tx data
    Providers-->>Oracle: Value + timestamp + confirmations
    Oracle-->>UI: Signed canonical payload
    UI->>ZK: Build witness + generate proof
    ZK-->>UI: proof + publicSignals
    UI-->>User: Share link/QR payload
    User->>Verify: Open verify link
    Verify->>Verify: Verify proof + signals
    Verify-->>User: Verified receipt or invalid warning
```

## Tech Stack
- Frontend:
- Next.js (App Router), React, TypeScript
- Tailwind CSS + reusable UI components
- TanStack Query + React Hook Form + Zod
- Backend/Edge:
- Cloudflare Workers (optional deploy target)
- Node/Next API fallback for local-first no-card mode
- ZK:
- Circom 2 + snarkjs
- Data:
- BTC: mempool.space primary, Blockchair fallback
- ETH: public RPC (viem) primary, Etherscan fallback via managed server-side key pool (Etherscan-only keyed source)
- Reliability:
- Provider/key cascade manager with immediate failover and bounded concurrency (smartcontractpatternfinder-style)

## Quick Start
```bash
# 1) Clone
git clone https://github.com/teycir/GhostReceipt.git
cd GhostReceipt

# 2) Install
npm install

# 3) Configure
cp .env.example .env.local

# 4) Run
npm run dev
```

Open `http://localhost:3000`.

## Configuration
- No-credit-card mode:
- Default local setup must work with free/public providers
- No-user-API-key mode:
- Users are not required to bring API keys
- Optional BYOK:
- Power users can add keys for higher throughput, but core UX must remain keyless
- Server-managed keys:
- Sensitive provider keys live only in `.env.local`/deployment secrets and must never be committed
- ETH managed keyed fallback is Etherscan-only for now; other provider keys will be added later without changing the UX contract

## FAQ
### Is GhostReceipt custodial?
No. Proof generation and sensitive witness data stay in the client-side flow.

### Do users need to connect a wallet?
No for the base flow. Users only provide tx hash and claim parameters.

### Do users need API keys?
No. API key entry is optional advanced mode only.

### Can this run without a credit card?
Yes. Local setup and baseline flow are designed for no-card operation.

### What does the verifier see?
Only proof-related public claims and redacted receipt output, not raw sensitive identities.

### Is Monero supported?
Planned as a dedicated track with separate constraints due to hidden amounts.

## References
- Product plan: [Plan.md](./Plan.md)
- Execution checklist: [ROADMAP.md](./ROADMAP.md)
- Reuse sources:
- `/home/teycir/Repos/xmrproof`
- `/home/teycir/Repos/Timeseal`
- `/home/teycir/Repos/Sanctum`
- `/home/teycir/Repos/smartcontractpatternfinder`

## Contact
- Creator: [Teycir Ben Soltane](https://teycirbensoltane.tn)
- Issues: `https://github.com/teycir/GhostReceipt/issues`
- Security inquiries: open a private issue with `[SECURITY]` in title
