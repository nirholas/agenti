# Task: Add Safety Guards for Token Approvals

## Priority: HIGH

## Context
`src/evm/modules/tokens/tools.ts:565-566` allows unlimited (max uint256) token approvals without warning. If the approved contract is compromised, the user's entire token balance can be drained.

## Requirements
1. When `amount` is "unlimited" or "max", return a response requiring explicit confirmation with a warning about risks
2. Add a `maxApprovalAmount` parameter that defaults to 2x the required amount
3. Include the current token balance and USD value in the approval response
4. Log all approval operations to the security audit trail
5. Add a `revoke_approval` tool to set allowance back to 0
6. Add a `check_approvals` tool to list all active token approvals for a wallet

## Acceptance Criteria
- [ ] Unlimited approvals require explicit confirmation
- [ ] Default approval amount is bounded (2x required)
- [ ] `revoke_approval` and `check_approvals` tools implemented
- [ ] All approvals logged to audit trail
- [ ] Tests for approval flows
