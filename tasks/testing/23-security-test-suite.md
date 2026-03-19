# Task: Create Security-Focused Test Suite

## Priority: HIGH

## Context
Security tests should verify that all identified vulnerabilities are fixed and prevent regressions. These tests encode the security requirements as executable specifications.

## Requirements
1. **Input validation tests**:
   - SQL injection payloads in all string parameters
   - XSS payloads in all string parameters
   - Path traversal attempts (`../../../etc/passwd`)
   - Oversized inputs (1MB+ strings, arrays with 100K elements)
   - Unicode edge cases (null bytes, RTL override, homoglyphs)
2. **Authentication tests**:
   - Missing auth header returns 401
   - Invalid API key returns 401
   - Expired key returns 401
   - Revoked key returns 401
   - Brute force lockout triggers after threshold
3. **Authorization tests**:
   - Read-only key cannot execute trades
   - Per-tool permission enforcement
4. **Crypto-specific tests**:
   - Cannot transfer to zero address
   - Cannot approve negative amounts
   - Slippage bounds enforced
   - Network name typos rejected
5. **Sandbox escape tests** (for code execution):
   - Access to `process`, `require`, `import` blocked
   - File system access blocked
   - Network access blocked
6. Run as a dedicated CI job on every PR

## Acceptance Criteria
- [ ] 100+ security test cases
- [ ] All OWASP Top 10 categories covered
- [ ] Crypto-specific attack vectors tested
- [ ] Sandbox escape tests passing
- [ ] CI job runs on every PR
