# Contributing to GhostReceipt

Thank you for your interest in contributing to GhostReceipt!

## Prerequisites

- Node.js 20.9.0 or higher
- npm 9.0.0 or higher

### Check your versions

```bash
node --version  # Should be >= 20.9.0
npm --version   # Should be >= 9.0.0
```

### Install Node.js 20

If you need to upgrade:

**Using nvm (recommended):**
```bash
nvm install 20
nvm use 20
```

**Or download from:**
https://nodejs.org/

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/teycir/GhostReceipt.git
   cd GhostReceipt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values (optional for basic dev)
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

## Code Standards

### TypeScript
- Use strict mode (already configured)
- Explicit return types for all functions
- No `any` types (use `unknown` if needed)
- Use Zod for runtime validation

### Error Handling
**CRITICAL**: Never use empty catch blocks or silent error suppression.

❌ **FORBIDDEN:**
```typescript
try {
  // code
} catch (error) {
  // Empty - NEVER DO THIS
}
```

✅ **REQUIRED:**
```typescript
try {
  // code
} catch (error) {
  if (error instanceof TypeError) {
    return false;
  }
  throw error; // Re-throw unexpected errors
}
```

### Testing
- All tests in `/tests` directory
- Write tests for new features
- Maintain CI coverage thresholds defined in `jest.config.js`

### Documentation
- Main docs index: `docs/README.md`
- Planning docs: `docs/project/`
- Operational runbooks: `docs/runbooks/`
- Keep root docs minimal (`README.md`, `CONTRIBUTING.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`)

### Commit Messages
Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `test:` Test changes
- `refactor:` Code refactoring

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm test`
4. Run type check: `npm run typecheck`
5. Run linter: `npm run lint`
6. Commit with conventional commit message
7. Push and create pull request
8. Fill out PR template completely

## Code Review

All submissions require review. We use GitHub pull requests for this purpose.

## Questions?

Open an issue or contact: https://teycirbensoltane.tn
