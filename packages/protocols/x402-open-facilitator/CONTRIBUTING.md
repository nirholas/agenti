# Contributing to OpenFacilitator

Thank you for your interest in contributing to OpenFacilitator! Our goal is to build the most robust, secure, and well-audited x402 facilitator implementation available. Every contribution matters.

## 🎯 Project Goals

OpenFacilitator aims to be:

- **Production-ready** — Code that handles real money must be bulletproof
- **Auditable** — Clear, readable code that security auditors can verify
- **Reusable** — Clean abstractions that others can build upon
- **Well-tested** — Comprehensive test coverage for all critical paths

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Security Guidelines](#security-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Be respectful, inclusive, and constructive. We're building critical financial infrastructure together.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Git

### Development Setup

```bash
# Clone the repository
git clone https://github.com/rawgroundbeef/openfacilitator.git
cd openfacilitator

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- **Dashboard**: http://localhost:3002
- **API Server**: http://localhost:3001

### Environment Variables

Copy the example environment file and configure:

```bash
cp packages/server/.env.example packages/server/.env
```

Required variables:
- `BETTER_AUTH_SECRET` — Random 32+ character string for session encryption
- `DATABASE_PATH` — SQLite database location (default: `./data/openfacilitator.db`)

## Project Structure

```
openfacilitator/
├── apps/
│   └── dashboard/          # Next.js dashboard UI
├── packages/
│   ├── core/               # Core facilitator logic (verify, settle, supported)
│   ├── server/             # Multi-tenant Express server
│   ├── sdk/                # TypeScript SDK for clients
│   ├── cli/                # CLI for self-hosting
│   └── integration-tests/  # End-to-end tests against real networks
├── examples/               # Example implementations
└── docs/                   # Documentation
```

### Package Responsibilities

| Package | Purpose | Critical? |
|---------|---------|-----------|
| `@openfacilitator/core` | Payment verification & settlement logic | 🔴 Yes |
| `@openfacilitator/server` | HTTP API, auth, multi-tenancy | 🔴 Yes |
| `@openfacilitator/sdk` | Client SDK for integrators | 🟡 Medium |
| `@openfacilitator/cli` | Self-hosting CLI tool | 🟢 Low |
| `dashboard` | Web UI for managing facilitators | 🟢 Low |

## Coding Standards

### TypeScript

- **Strict mode** — All packages use `strict: true`
- **Explicit types** — Prefer explicit return types on public functions
- **No `any`** — Use `unknown` and narrow types properly
- **Readonly by default** — Use `readonly` for data that shouldn't mutate

```typescript
// ✅ Good
export async function verifyPayment(
  payment: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerifyResult> {
  // ...
}

// ❌ Bad
export async function verifyPayment(payment: any, requirements: any) {
  // ...
}
```

### Error Handling

- **Never swallow errors** — Always log or propagate
- **Use typed errors** — Create specific error classes for different failure modes
- **Fail fast** — Validate inputs early and reject invalid data immediately

```typescript
// ✅ Good
if (!isValidAddress(payTo)) {
  throw new InvalidAddressError(`Invalid payTo address: ${payTo}`);
}

// ❌ Bad
try {
  // risky operation
} catch (e) {
  // silently ignore
}
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes/Types**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`

### Comments

- Document **why**, not **what**
- Use JSDoc for public APIs
- Add `// SECURITY:` comments for security-critical code

```typescript
// SECURITY: Validate signature before any state changes
const isValid = await verifySignature(payment);
if (!isValid) {
  throw new InvalidSignatureError();
}
```

## Security Guidelines

This project handles real money. Security is paramount.

### Critical Security Rules

1. **Never log sensitive data** — No private keys, signatures, or user credentials in logs
2. **Validate all inputs** — Never trust user input; validate addresses, amounts, signatures
3. **Use constant-time comparisons** — For signature verification to prevent timing attacks
4. **Principle of least privilege** — Request only necessary permissions
5. **Fail secure** — When in doubt, reject the transaction

### Before Submitting Security-Critical Code

- [ ] Have you validated all user inputs?
- [ ] Are there any new attack vectors introduced?
- [ ] Have you considered replay attacks?
- [ ] Are error messages safe (no sensitive data leaked)?
- [ ] Is the code auditable and easy to review?

### Reporting Security Vulnerabilities

**Do not open public issues for security vulnerabilities.**

Email security concerns to the maintainers directly. We'll work with you to address the issue responsibly.

## Testing Requirements

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit Tests | `*.test.ts` | Test individual functions |
| Integration Tests | `packages/integration-tests/` | Test against real networks |

### Running Tests

```bash
# Run all tests
pnpm test

# Run integration tests (requires network access)
cd packages/integration-tests
pnpm test
```

### What to Test

**Critical paths that MUST have tests:**

- Payment signature verification
- Settlement transaction construction
- Amount calculations (especially decimals!)
- Authorization validation
- Replay protection

**Example test structure:**

```typescript
describe('verifyPayment', () => {
  it('should accept valid ERC-3009 authorization', async () => {
    // ...
  });

  it('should reject expired authorization', async () => {
    // ...
  });

  it('should reject invalid signature', async () => {
    // ...
  });

  it('should reject amount exceeding maxAmount', async () => {
    // ...
  });
});
```

### Test Coverage Goals

- Core package: **90%+** coverage
- Server routes: **80%+** coverage
- SDK: **80%+** coverage

## Pull Request Process

### Before Opening a PR

1. **Create an issue first** — Discuss the change before implementing
2. **Keep PRs focused** — One feature or fix per PR
3. **Update tests** — Add or update tests for your changes
4. **Update docs** — If you change behavior, update documentation

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally (`pnpm test`)
- [ ] New code has appropriate test coverage
- [ ] Documentation is updated if needed
- [ ] Commit messages are clear and descriptive
- [ ] No sensitive data in code or comments

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add Arbitrum network support
fix: prevent double-settlement on concurrent requests
docs: update self-hosting guide with Docker instructions
security: add replay protection for ERC-3009 transfers
```

Prefixes:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `security:` — Security improvement
- `refactor:` — Code change that doesn't fix a bug or add a feature
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

### Review Process

1. Open a PR against `main`
2. Automated checks will run (linting, tests)
3. A maintainer will review your code
4. Address any feedback
5. Once approved, a maintainer will merge

**For security-critical changes**, expect a more thorough review process.

## Reporting Issues

### Bug Reports

Include:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs (sanitized of sensitive data)

### Feature Requests

Include:
- Clear description of the feature
- Use case / why it's needed
- Any implementation ideas

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special thanks in documentation for major features

## Questions?

- Open a GitHub Discussion for general questions
- Check existing issues before creating new ones
- Join the x402 community for protocol-level discussions

---

Thank you for helping make OpenFacilitator the best x402 facilitator implementation. Your contributions make decentralized payments more accessible to everyone. 🚀

