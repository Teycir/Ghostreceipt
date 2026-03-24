# GhostReceipt Enhancement Roadmap

**Status**: Draft  
**Last Updated**: 2025-01-XX  
**Source**: Community review feedback + security analysis

This roadmap prioritizes enhancements based on impact, effort, and strategic value. Items are organized by theme and assigned to implementation phases.
Budget policy: active roadmap items must be executable with zero mandatory spend (no required gas fees, paid tiers, or extra hosted infrastructure).

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
- [ ] Implement server-side registry with local in-memory default and optional free-tier shared backend
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

## ⚡ Phase 2: Core ZK Evolution (P1)

**Goal**: Unlock major use cases and improve proof system

### 2.1 Proof System Decision & Documentation (P1)
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

## 🔗 Phase 4: Shareability Expansion (P2)

**Goal**: Improve shareability and verification ergonomics without paid dependencies

### 4.1 Proof Compression (P2)
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

## 📊 Implementation Timeline

### Q1 2025 (Phase 1-2)
- ✅ Nullifier registry
- ✅ Replay protection
- ✅ Transparency log
- ✅ Proof system decision

### Q2 2025 (Phase 3-4)
- Batch verify
- PDF export
- Receipt labels
- Local history
- Proof compression

### Q3 2025 (Phase 5)
- Selective disclosure
- Range proofs

---

## Success Metrics

### Security Metrics
- Zero oracle key compromises
- Zero nullifier collisions
- 100% replay attack prevention

### Adoption Metrics
- 1000+ receipts generated (Q1)
- 10+ recurring teams using local/off-chain verification flows (Q2)

### UX Metrics
- <60s generation time maintained
- <5s verification time
- >90% mobile usability score

---

## Dependencies & Risks

### Technical Dependencies
- snarkjs proof system stability
- browser performance across low-end devices

### Risks
- **Circuit complexity**: Selective disclosure may increase proof time
- **Payload bloat**: richer UX metadata can increase share payload size

### Mitigation
- Benchmark proof times before shipping new circuits
- Keep compression/versioning backward-compatible and test QR payload limits

---

## References

- Original roadmap: [ROADMAP.md](./ROADMAP.md)
- Security model: [docs/runbooks/SECURITY.md](../runbooks/SECURITY.md)
- Threat model: [docs/runbooks/THREAT_MODEL.md](../runbooks/THREAT_MODEL.md)
- Circuit review: [docs/runbooks/CIRCUIT_SELF_REVIEW.md](../runbooks/CIRCUIT_SELF_REVIEW.md)

---

## Changelog

- **2025-01-XX**: Initial enhancement roadmap created from community review feedback
