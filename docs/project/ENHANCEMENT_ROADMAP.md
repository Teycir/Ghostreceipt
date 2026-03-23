# GhostReceipt Enhancement Roadmap

**Status**: Draft  
**Last Updated**: 2025-01-XX  
**Source**: Community review feedback + security analysis

This roadmap prioritizes enhancements based on impact, effort, and strategic value. Items are organized by theme and assigned to implementation phases.

---

## Priority Matrix

| Priority | Impact | Effort | Phase |
|----------|--------|--------|-------|
| **P0 - Critical** | High security/trust impact | Any | 1-2 |
| **P1 - High** | Unlocks major use cases | Low-Medium | 2-3 |
| **P2 - Medium** | Significant UX/product value | Medium | 3-5 |
| **P3 - Low** | Nice-to-have improvements | Any | 5+ |

---

## 🔐 Phase 1: Trust Architecture Hardening (P0)

**Goal**: Eliminate single points of failure in trust model

### 1.1 Nullifier Registry (P0)
**Problem**: Nothing prevents generating multiple receipts for same tx with different claims  
**Solution**: Server-side nullifier registry keyed on `txHash + chain`

- [ ] Design nullifier commitment scheme
- [ ] Implement server-side registry (Redis/KV store)
- [ ] Add nullifier to receipt payload
- [ ] Update verifier to check nullifier
- [ ] Document nullifier verification flow

**Effort**: Low-Medium (1-2 weeks)  
**Impact**: Closes critical attack vector

### 1.2 Oracle Signature Replay Protection (P0)
**Problem**: Intercepted oracle signatures could be reused to generate fresh proofs  
**Solution**: Add timestamp/nonce binding to oracle signatures

- [ ] Add timestamp + nonce to oracle signature payload
- [ ] Implement replay window validation (e.g., 5-minute window)
- [ ] Update oracle signature verification
- [ ] Add replay detection tests
- [ ] Document replay protection mechanism

**Effort**: Low (1 week)  
**Impact**: Prevents signature replay attacks

### 1.3 Oracle Transparency Log (P0)
**Problem**: No public record of oracle key validity periods  
**Solution**: Append-only log of oracle public keys with activation/revocation dates

- [ ] Design transparency log format (JSON)
- [ ] Create GitHub-hosted transparency log
- [ ] Add key rotation workflow
- [ ] Update verifier to check key validity
- [ ] Automate log updates in CI/CD

**Effort**: Low (1 week)  
**Impact**: Builds trust, enables independent verification

---

## ⚡ Phase 2: Core ZK & Chain Expansion (P1)

**Goal**: Unlock major use cases and improve proof system

### 2.1 On-Chain Solidity Verifier (P1)
**Problem**: Smart contracts can't verify receipts trustlessly  
**Solution**: Deploy snarkjs-generated Solidity verifier contract

- [ ] Generate Solidity verifier from circuit
- [ ] Deploy to mainnet + testnets (ETH, Polygon, Arbitrum)
- [ ] Create contract verification guide
- [ ] Add contract addresses to docs
- [ ] Build example escrow integration

**Effort**: Low (1 week)  
**Impact**: Enables trustless DAO/escrow use cases

### 2.2 ERC-20 Transfer Proofs (P1)
**Problem**: Most real payments use tokens (USDC, USDT, DAI), not raw ETH  
**Solution**: Support `Transfer` event log proofs

- [ ] Design event log proof circuit extension
- [ ] Update oracle to fetch/normalize Transfer events
- [ ] Add token address + decimals to witness
- [ ] Update UI for token selection
- [ ] Test with major stablecoins

**Effort**: Medium (2-3 weeks)  
**Impact**: Covers 80% of real-world payments

### 2.3 Proof System Decision & Documentation (P1)
**Problem**: No explicit Groth16 vs PLONK decision documented  
**Solution**: Evaluate and commit to proving system

- [ ] Document current Groth16 usage
- [ ] Evaluate PLONK/Fflonk trade-offs
- [ ] Make explicit decision with rationale
- [ ] Update trusted setup docs if staying with Groth16
- [ ] Plan migration path if switching to PLONK

**Effort**: Low (research + docs, 1 week)  
**Impact**: Clarifies upgrade path, reduces ceremony burden

---

## 🎨 Phase 3: UX & Product Features (P1-P2)

**Goal**: Improve usability for key user segments

### 3.1 Batch Verify (P1)
**Problem**: Accounting/compliance teams need to verify 10s-100s of receipts  
**Solution**: Multi-receipt verifier with pass/fail table

- [ ] Design batch verify UI (`/verify/batch`)
- [ ] Implement drag-and-drop receipt upload
- [ ] Add parallel verification with progress
- [ ] Export verification report (CSV/JSON)
- [ ] Add batch verify to docs

**Effort**: Medium (2 weeks)  
**Impact**: Unlocks accounting/compliance segment

### 3.2 PDF Export (P2)
**Problem**: Users need to attach receipts to invoices  
**Solution**: Print-friendly PDF with embedded proof data

- [ ] Design PDF receipt template
- [ ] Add QR code + human-readable summary
- [ ] Implement client-side PDF generation
- [ ] Add "Download PDF" button to receipt page
- [ ] Cross-link with TimeSeal/Sanctum workflows

**Effort**: Low (1 week)  
**Impact**: Satisfies invoice attachment workflow

### 3.3 Receipt Labels & Categories (P2)
**Problem**: No context for what a receipt represents  
**Solution**: User-defined tags at generation time

- [ ] Add optional label/category field to generator
- [ ] Include metadata in shareable payload
- [ ] Display labels on verifier page
- [ ] Add label filtering to history view
- [ ] Document metadata schema

**Effort**: Low (1 week)  
**Impact**: Improves receipt organization and context

### 3.4 Local Receipt History (P2)
**Problem**: No way to track previously generated receipts  
**Solution**: IndexedDB-based browser-only history

- [ ] Implement IndexedDB storage layer
- [ ] Create `/history` dashboard page
- [ ] Add export history as JSON
- [ ] Add search/filter by chain, date, label
- [ ] Document privacy guarantees (never leaves browser)

**Effort**: Medium (2 weeks)  
**Impact**: Gives return users reason to bookmark app

---

## 🔗 Phase 4: Chain & Integration Expansion (P2)

**Goal**: Expand chain support and enable B2B integrations

### 4.1 Monero Adapter (P1)
**Problem**: Monero's privacy features require specialized ZK approach  
**Solution**: Dedicated Monero receipt track with view key proofs

- [ ] Design Monero-specific circuit (hidden amounts, stealth addresses)
- [ ] Implement view key proof mechanism
- [ ] Add Monero RPC provider (monerod + public nodes)
- [ ] Handle tx_key + view_key witness inputs
- [ ] Add XMR to chain selector
- [ ] Document Monero trust model differences
- [ ] Test with stagenet/testnet

**Effort**: High (4-5 weeks)  
**Impact**: Unlocks privacy-focused payment proofs, completes major crypto coverage

**Note**: Monero requires separate circuit constraints due to:
- Hidden transaction amounts (RingCT)
- Stealth addresses (one-time keys)
- View key verification instead of public blockchain data

### 4.2 Solana Adapter (P2)
**Problem**: SOL payments are huge in freelance/DAO space  
**Solution**: Add Solana chain adapter

- [ ] Design Solana provider interface
- [ ] Implement Solana RPC + Helius fallback
- [ ] Add SOL to chain selector
- [ ] Update circuit for Solana tx format
- [ ] Test with SPL token transfers

**Effort**: Medium (2-3 weeks)  
**Impact**: Covers major freelance/DAO ecosystem

### 4.3 Webhook / Embed API (P2)
**Problem**: No programmatic receipt generation for platforms  
**Solution**: REST API for B2B integrations

- [ ] Design `POST /api/generate-receipt` endpoint
- [ ] Add API authentication (optional API keys)
- [ ] Document REST API spec
- [ ] Create integration examples
- [ ] Add rate limiting for API endpoints

**Effort**: Medium (2 weeks)  
**Impact**: Unlocks escrow/marketplace integrations

### 4.4 Proof Compression (P2)
**Problem**: Share links are long, QR codes hard to scan  
**Solution**: Compress proof data in share payloads

- [ ] Evaluate proof compression schemes
- [ ] Implement compression/decompression
- [ ] Update share payload format (versioned)
- [ ] Test QR code scannability
- [ ] Maintain backward compatibility

**Effort**: Low-Medium (1-2 weeks)  
**Impact**: Improves shareability, especially mobile

---

## ⚙️ Phase 5: Advanced ZK Features (P2-P3)

**Goal**: Enable more flexible privacy controls

### 5.1 Selective Disclosure (P2)
**Problem**: All-or-nothing redaction limits real use cases  
**Solution**: Partial reveal options (e.g., timestamp only, sender membership proof)

- [ ] Design selective disclosure circuit extensions
- [ ] Add disclosure options to generator UI
- [ ] Update witness builder for partial reveals
- [ ] Add disclosure mode to receipt payload
- [ ] Document disclosure patterns

**Effort**: Medium (3 weeks)  
**Impact**: More flexible privacy for compliance

### 5.2 Range Proof for Amount (P3)
**Problem**: `value >= claimedAmount` leaks exact threshold  
**Solution**: Prove amount is in range without revealing more

- [ ] Design range proof circuit
- [ ] Add range bounds to generator UI
- [ ] Update witness builder
- [ ] Test with compliance scenarios
- [ ] Document range proof use cases

**Effort**: Medium (2-3 weeks)  
**Impact**: Better privacy for compliance workflows

---

## 🏗️ Phase 6: Multi-Oracle Architecture (P0 - Long Term)

**Goal**: Eliminate centralized oracle trust assumption

### 6.1 Multi-Oracle Quorum (P0)
**Problem**: Single oracle key compromise invalidates all receipts  
**Solution**: 2-of-3 or 3-of-5 oracle quorum with public keys

- [ ] Design multi-oracle signature scheme
- [ ] Implement quorum verification in circuit
- [ ] Deploy multiple oracle instances
- [ ] Update verifier for quorum checks
- [ ] Document oracle operator requirements

**Effort**: High (4-6 weeks)  
**Impact**: Removes single point of failure

### 6.2 TLS-Notary Integration (P0)
**Problem**: Still requires trusting oracle operator  
**Solution**: TLS-Notary as alternative oracle source

- [ ] Research TLS-Notary integration path
- [ ] Design TLS-Notary proof adapter
- [ ] Implement provider-agnostic verification
- [ ] Add TLS-Notary option to generator
- [ ] Document trust model comparison

**Effort**: High (6-8 weeks)  
**Impact**: Eliminates "trust the operator" assumption

---

## 📊 Implementation Timeline

### Q1 2025 (Phase 1-2)
- ✅ Nullifier registry
- ✅ Replay protection
- ✅ Transparency log
- ✅ On-chain verifier
- ✅ ERC-20 support
- ✅ Proof system decision

### Q2 2025 (Phase 3-4)
- Batch verify
- PDF export
- Receipt labels
- Local history
- Monero adapter (dedicated track)
- Solana adapter
- Webhook API

### Q3 2025 (Phase 5)
- Selective disclosure
- Range proofs
- Proof compression

### Q4 2025 (Phase 6)
- Multi-oracle quorum
- TLS-Notary integration

---

## Success Metrics

### Security Metrics
- Zero oracle key compromises
- Zero nullifier collisions
- 100% replay attack prevention

### Adoption Metrics
- 1000+ receipts generated (Q1)
- 10+ B2B integrations (Q2)
- 50+ on-chain verifications (Q2)

### UX Metrics
- <60s generation time maintained
- <5s verification time
- >90% mobile usability score

---

## Dependencies & Risks

### Technical Dependencies
- snarkjs Solidity verifier generation
- TLS-Notary protocol stability
- Multi-oracle coordination infrastructure

### Risks
- **Circuit complexity**: Selective disclosure may increase proof time
- **Oracle coordination**: Multi-oracle quorum needs reliable operators
- **ERC-20 gas costs**: On-chain verification may be expensive for some chains

### Mitigation
- Benchmark proof times before shipping new circuits
- Start with 2-of-3 quorum, expand gradually
- Deploy verifiers to L2s for lower gas costs

---

## References

- Original roadmap: [ROADMAP.md](./ROADMAP.md)
- Security model: [docs/runbooks/SECURITY.md](../runbooks/SECURITY.md)
- Threat model: [docs/runbooks/THREAT_MODEL.md](../runbooks/THREAT_MODEL.md)
- Circuit review: [docs/runbooks/CIRCUIT_SELF_REVIEW.md](../runbooks/CIRCUIT_SELF_REVIEW.md)

---

## Changelog

- **2025-01-XX**: Initial enhancement roadmap created from community review feedback
