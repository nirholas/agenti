# Task: Harden CI/CD Pipeline

## Priority: HIGH

## Context
The CI pipeline (`/.github/workflows/ci.yml`) uses `|| true` on all test, lint, and audit steps, making failures invisible. The release pipeline uses `--no-git-checks` for publishing.

## Requirements
1. **Remove `|| true`** from all critical CI steps:
   - Linting (ESLint + TypeScript)
   - Unit tests
   - Security audit (`npm audit --audit-level=high`)
2. Keep `|| true` only for genuinely optional steps (e.g., coverage upload)
3. **Remove `--no-git-checks`** from npm/pnpm publish commands
4. Add required CI checks for PR merge:
   - Build succeeds
   - All unit tests pass
   - Lint passes
   - Security audit passes (no HIGH vulnerabilities)
   - Type checking passes
5. Add branch protection rules:
   - Require PR reviews (minimum 1)
   - Require status checks to pass
   - No force push to main
   - No direct push to main
6. Pin all GitHub Actions to SHA (not tags) to prevent supply chain attacks
7. Add CODEOWNERS file for critical paths (security, payments, config)
8. Add `continue-on-error: false` explicitly to critical steps

## Acceptance Criteria
- [ ] No `|| true` on critical CI steps
- [ ] No `--no-git-checks` on publish
- [ ] Branch protection configured
- [ ] Actions pinned to SHAs
- [ ] CODEOWNERS file created
