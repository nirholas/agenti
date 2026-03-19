# Task: Validate EIP-712 Domain Parameters

## Priority: MEDIUM

## Context
`src/evm/modules/signatures/tools.ts:96-140` accepts user-provided EIP-712 domains without validation. Users could be tricked into signing messages for the wrong chain or contract (phishing).

## Requirements
1. Validate that `domain.chainId` matches the currently connected chain
2. Validate that `domain.verifyingContract` is a deployed contract (code size > 0)
3. Add a warning when domain name doesn't match known protocols
4. Maintain an allowlist of known trusted EIP-712 domains (Uniswap, OpenSea, etc.)
5. Log all signing requests to the security audit trail
6. Add replay protection by tracking recently signed message hashes

## Acceptance Criteria
- [ ] Chain ID mismatch is rejected with clear error
- [ ] Contract existence is verified before signing
- [ ] Known domain allowlist implemented
- [ ] All sign operations logged
- [ ] Tests for phishing scenarios
