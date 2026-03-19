# Task: Build Comprehensive Integration Test Suite

## Priority: HIGH

## Context
Integration tests must verify that MCP tools work end-to-end against real (testnet) blockchain infrastructure and mocked external APIs.

## Requirements
1. Create integration test infrastructure:
   - Local Hardhat/Anvil node for EVM tests
   - Mock servers for external APIs (CoinGecko, Binance, Tatum)
   - Test wallet with testnet funds
2. Integration test categories:
   - **EVM Tools**: Deploy, transfer, swap, approve on local fork
   - **MCP Protocol**: Full MCP request/response cycle
   - **x402 Payments**: Payment flow on testnet
   - **Multi-chain**: Verify chain-specific tool behavior
3. Each test must:
   - Set up its own state (no shared mutable state between tests)
   - Clean up after itself
   - Have a timeout (30s default)
4. Run integration tests in CI on a separate job (not blocking unit tests)
5. Tag tests with `@slow`, `@network`, `@testnet` for selective execution
6. Add retry logic for flaky network-dependent tests (max 2 retries)

## Acceptance Criteria
- [ ] Local blockchain node in test setup
- [ ] Mock servers for all external APIs
- [ ] 50+ integration tests across all tool categories
- [ ] CI job for integration tests
- [ ] No shared mutable state between tests
