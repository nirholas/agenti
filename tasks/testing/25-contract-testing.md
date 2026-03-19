# Task: Add Contract Tests for External API Integrations

## Priority: MEDIUM

## Context
The project depends on many external APIs (CoinGecko, Binance, Tatum, Etherscan, etc.). Contract tests verify that our assumptions about these APIs remain valid.

## Requirements
1. Set up Pact or similar contract testing framework
2. Create contract tests for each external API:
   - **CoinGecko**: Price endpoints, market data, coin info
   - **Binance**: Account info, order book, order placement
   - **Tatum**: Blockchain API endpoints
   - **Etherscan**: Contract verification, ABI retrieval
   - **RPC Providers**: eth_call, eth_getBalance, eth_sendTransaction
3. Each contract test should verify:
   - Response schema matches our types
   - Required fields are present
   - Data types are correct
   - Error responses match expected format
4. Run contract tests on a weekly schedule (not every PR — these hit real APIs)
5. Alert on contract breakage via Slack/email notification
6. Generate compatibility matrix showing which API versions we support

## Acceptance Criteria
- [ ] Contract tests for top 5 external APIs
- [ ] Weekly scheduled CI run
- [ ] Alerting on contract breakage
- [ ] Compatibility matrix documented
