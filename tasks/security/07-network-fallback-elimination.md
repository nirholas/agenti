# Task: Remove Silent Network Fallback to Mainnet

## Priority: HIGH

## Context
`src/evm/chains.ts:137-139` silently defaults unknown network names to Ethereum mainnet. A typo in network name could send real funds on the wrong chain with no recovery.

## Requirements
1. Replace the default fallback with an explicit error: `throw new Error("Unknown network: '${network}'. Supported networks: ${list}")`
2. Add fuzzy matching suggestion: "Did you mean 'polygon'?" when input is close to a valid network
3. List all supported networks in the error message
4. Add case-insensitive network name matching
5. Add a `list_supported_networks` tool for discoverability
6. Update all callers to handle the new error

## Acceptance Criteria
- [ ] Unknown networks throw descriptive errors
- [ ] Case-insensitive matching works
- [ ] Fuzzy suggestions provided for near-matches
- [ ] `list_supported_networks` tool available
- [ ] No silent fallback to any default network
