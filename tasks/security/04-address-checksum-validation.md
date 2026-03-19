# Task: Enforce EIP-55 Checksum Validation on All Address Inputs

## Priority: HIGH

## Context
`src/evm/services/ens.ts:23` accepts any 40-character hex string as a valid address without EIP-55 checksum validation. The x402 module already has proper validation at `src/x402/security.ts:145-155` but it's not used elsewhere. Incorrect addresses mean irreversible loss of funds.

## Requirements
1. Create a shared `validateAndNormalizeAddress(input: string): Address` utility using viem's `getAddress()`
2. Replace all raw regex-based address checks with this utility
3. Apply checksum validation in:
   - `src/evm/services/ens.ts`
   - `src/evm/services/transfer.ts`
   - `src/evm/modules/tokens/tools.ts`
   - `src/evm/modules/swap/tools.ts`
   - All tool Zod schemas accepting address parameters
4. Return clear error messages when checksum fails (include the checksummed version in the error)
5. Add a Zod custom type `zodEthAddress` for reuse across all schemas

## Acceptance Criteria
- [ ] All address inputs validated with EIP-55 checksums
- [ ] Shared `zodEthAddress` type used across all tool schemas
- [ ] Error messages include the correct checksummed address
- [ ] Tests for mixed-case, lowercase, and invalid addresses
