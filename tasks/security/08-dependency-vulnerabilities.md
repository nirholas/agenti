# Task: Remediate All Known Dependency Vulnerabilities

## Priority: HIGH

## Context
`npm audit` reports 11 vulnerabilities (7 HIGH, 3 MODERATE, 1 LOW), including `@x402/svm` security advisory, `@hono/node-server` auth bypass, `qs` prototype pollution, and `express-rate-limit` bypass.

## Requirements
1. Run `npm audit` and document all current vulnerabilities
2. Upgrade direct dependencies where possible:
   - `@x402/svm` to 2.6.0+
   - `@hono/node-server` to latest patched version
   - All `@x402/*` packages to latest
3. For transitive dependency vulnerabilities, add `overrides` in `package.json` where safe
4. If a vulnerability cannot be resolved, document the risk assessment and mitigation in a `SECURITY_EXCEPTIONS.md`
5. Add `npm audit --audit-level=high` as a blocking CI step (remove `|| true`)
6. Set up Dependabot or Renovate for automated security updates

## Acceptance Criteria
- [ ] Zero HIGH severity vulnerabilities
- [ ] All MODERATE vulnerabilities assessed and mitigated
- [ ] CI blocks on high-severity audit findings
- [ ] Automated dependency update bot configured
