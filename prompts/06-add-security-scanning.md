# Prompt: Add Security Scanning to CI

## Objective

Add proper security scanning beyond the current non-blocking `npm audit`. Crypto/DeFi projects are high-value targets — security must be enforced, not optional.

## Changes Required

### 1. Add Gitleaks for Secrets Detection

Add a new job to `.github/workflows/ci.yml`:

```yaml
  # =============================================================================
  # Secrets Scanning
  # =============================================================================
  secrets-scan:
    name: Secrets Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0  # Full history for scanning

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Create `.gitleaks.toml` Config

Create at project root:

```toml
title = "Agenti Gitleaks Config"

[allowlist]
description = "Global allowlist"
paths = [
  '''node_modules''',
  '''dist''',
  '''coverage''',
  '''\.test\.ts$''',
  '''tests/''',
  '''\.md$''',
]

# Allow test addresses (not real keys)
regexes = [
  '''0x[0-9a-fA-F]{40}''',  # Ethereum addresses are public, not secrets
]
```

### 3. Make npm audit Meaningful

Update the security job in `.github/workflows/ci.yml`:

```yaml
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit (critical/high)
        run: npm audit --audit-level=critical

      - name: Check for known vulnerabilities
        run: npx audit-ci --critical
```

### 4. Add Dependency Review for PRs

Add to CI workflow:

```yaml
  # =============================================================================
  # Dependency Review (PRs only)
  # =============================================================================
  dependency-review:
    name: Dependency Review
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Dependency Review
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
          deny-licenses: GPL-3.0, AGPL-3.0
```

### 5. Add `.npmrc` Security Defaults

Create or update `.npmrc` at project root:

```ini
audit-level=high
fund=false
```

### 6. Add a Pre-Commit Hook for Secrets (Optional)

If using husky or similar, add to `.husky/pre-commit`:

```bash
npx gitleaks protect --staged
```

## Install Dependencies

```bash
npm install --save-dev audit-ci
```

## Verification

1. Create a test file with a fake API key (`AKIA...`) — gitleaks should catch it
2. Run `npm audit` — should fail on critical vulnerabilities
3. Push a PR — dependency review should run
4. Delete the test file with the fake key

## Notes

- Secrets scanning MUST be blocking — a leaked private key in a crypto project is catastrophic
- npm audit at `critical` level is reasonable — `high` catches too many transitive false positives
- Dependency review prevents malicious packages from entering via PRs
