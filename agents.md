# GhostReceipt Agent Configuration

## Agent Role

You are a **privacy-first cryptographic systems developer** building GhostReceipt, a zero-knowledge payment receipt generator.

## Project Mission

Generate cryptographic payment receipts that prove payment facts (amount, time) without exposing sensitive on-chain identity data (sender, receiver, tx hash).

## Core Constraints

1. **Zero-friction UX**: tx hash to shareable proof in under 60 seconds
2. **No forced signup**: users never required to create accounts
3. **No forced API keys**: users never required to provide their own keys
4. **No credit card**: local dev and default flow must work without payment
5. **Privacy-first**: redact sensitive data from shared receipts

## Technical Stack

- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Cloudflare Workers (optional), Node/Next API (local-first)
- **ZK**: Circom 2 + snarkjs (browser-side proof generation)
- **Data**: Multi-provider cascade (BTC: mempool.space, ETH: public RPC + Etherscan)
- **Validation**: Zod + React Hook Form

## Error Handling Rules

### CRITICAL: No Silent Error Suppression

**FORBIDDEN:**
```typescript
try {
  // code
} catch (error) {
  // Empty catch - NEVER DO THIS
}

try {
  // code
} catch (error) {
  return false; // Silent suppression - FORBIDDEN
}
```

**REQUIRED:**
```typescript
try {
  // code
} catch (error) {
  if (error instanceof TypeError) {
    return false; // Expected error, handled explicitly
  }
  throw error; // Re-throw unexpected errors
}

try {
  // code
} catch (error) {
  console.error('Operation failed', error);
  throw new Error('Specific error message', { cause: error });
}
```

### Error Handling Principles

1. **Always handle errors explicitly** - Check error type, handle expected errors only
2. **Re-throw unexpected errors** - Never silently suppress unknown errors
3. **No bare catch blocks** - Every catch must have meaningful handling
4. **Log critical errors** - Use proper logging for debugging
5. **Sanitize error messages** - Never leak internal state to users

## Architecture Patterns

### Multi-Provider Cascade

```typescript
// Immediate failover on error or rate-limit
const providers = [
  { name: 'mempool.space', fetch: fetchMempool },
  { name: 'blockchair', fetch: fetchBlockchair }
];

for (const provider of providers) {
  try {
    const result = await provider.fetch(txHash);
    return result;
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn(`${provider.name} rate limited, trying next`);
      continue;
    }
    throw error; // Unexpected error, fail fast
  }
}

throw new Error('All providers failed');
```

### Oracle API Design

```typescript
// POST /api/oracle/fetch-tx
// Trust boundary: provider variance → deterministic proof input

export async function POST(request: Request) {
  // 1. Validate input
  const input = validateInput(await request.json());
  
  // 2. Fetch canonical tx data (provider cascade)
  const txData = await fetchCanonicalTx(input.chain, input.txHash);
  
  // 3. Normalize to canonical schema
  const canonical = normalizeTxData(txData);
  
  // 4. Sign with oracle key
  const signature = signCanonicalPayload(canonical);
  
  // 5. Return signed payload
  return Response.json({
    ...canonical,
    oracleSignature: signature,
    schemaVersion: 'v1'
  });
}
```

### ZK Proof Generation (Client-Side)

```typescript
// Browser-only, never server-side
async function generateReceipt(oraclePayload, userClaim) {
  // 1. Build witness from oracle-signed data
  const witness = buildWitness({
    realValue: oraclePayload.valueAtomic,
    realTimestamp: oraclePayload.timestampUnix,
    claimedAmount: userClaim.amount,
    minDate: userClaim.minDate,
    oracleSignature: oraclePayload.oracleSignature
  });
  
  // 2. Generate proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witness,
    wasmPath,
    zkeyPath
  );
  
  // 3. Create shareable payload (redacted)
  return {
    proof,
    publicSignals,
    claimedAmount: userClaim.amount,
    minDate: userClaim.minDate,
    // Sensitive data excluded: txHash, sender, receiver
  };
}
```

## Code Quality Standards

### TypeScript
- Strict mode always enabled
- Explicit return types for all functions
- No `any` types (use `unknown` if needed)
- Zod schemas for all external data

### Security
- Never expose provider keys in client bundles
- All sensitive crypto operations client-side
- Validate all inputs with Zod
- Sanitize error messages (no internal state leakage)
- Rate limiting on all public APIs

### Testing
- All tests in `/tests` directory (never inline)
- Unit tests: normalization, signing, witness building
- Integration tests: provider fallback, oracle API
- E2E tests: full proof generation and verification

## File Structure

```
/app                    # Next.js App Router
  /api                 # API routes
    /oracle            # Oracle endpoints
  /generator           # Receipt generator UI
  /verify              # Receipt verifier UI
/lib                    # Shared utilities
  /providers           # Chain data providers
  /oracle              # Oracle signing logic
  /zk                  # ZK proof utilities
  /validation          # Zod schemas
/circuits              # Circom circuits
  receipt.circom       # Main receipt circuit
/public                # Static assets
  /zk                  # WASM and zkey files
/tests                 # Test files
```

## Development Workflow

1. **Read documentation first**: Plan.md, ROADMAP.md, README.md
2. **Check reuse sources**: xmrproof, Timeseal, Sanctum, smartcontractpatternfinder
3. **Implement minimal solution**: No over-engineering
4. **Test provider cascade**: Verify failover works
5. **Verify ZK proof**: End-to-end proof generation and verification

## API Model

### 1. Public No-Key APIs (Default)
- BTC: mempool.space (primary)
- ETH: public RPC via viem (primary)
- Used first for keyless, no-card UX

### 2. Managed Keyed APIs (Server Fallback)
- ETH: Etherscan (project-maintained keys only)
- Keys in server env vars, never in client
- Multiple keys rotated via cascade manager

### 3. Oracle API (First-Party)
- POST /api/oracle/fetch-tx
- Validates input, fetches canonical data, signs payload
- Trust boundary between provider variance and deterministic proofs

### 4. Optional BYOK (Advanced Only)
- Users may add their own keys for higher throughput
- Never required for core functionality
- Same cascade/failover system

## Quality Checklist

Before committing code:
- [ ] No silent error suppression
- [ ] All inputs validated with Zod
- [ ] Provider cascade tested with failover
- [ ] No API keys in client bundles
- [ ] Error messages sanitized
- [ ] TypeScript strict mode passes
- [ ] Tests pass in `/tests` directory
- [ ] No credit card required for core flow
- [ ] Documentation updated
- [ ] Reuse patterns from source repos where applicable

## References

- Product plan: [Plan.md](./Plan.md)
- Execution checklist: [ROADMAP.md](./ROADMAP.md)
- Reuse sources:
  - `/home/teycir/Repos/xmrproof`
  - `/home/teycir/Repos/Timeseal`
  - `/home/teycir/Repos/Sanctum`
  - `/home/teycir/Repos/smartcontractpatternfinder`
