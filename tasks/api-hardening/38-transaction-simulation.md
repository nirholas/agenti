# Task: Add Transaction Simulation Before Execution

## Priority: HIGH

## Context
Executing blockchain transactions without simulation risks irreversible loss of funds. Enterprise-grade systems must simulate transactions to verify expected outcomes before broadcasting.

## Requirements
1. Add a `simulate` parameter (default `true`) to all write operations:
   - `transfer_eth`, `transfer_token`
   - `swap_tokens` (all DEX variants)
   - `approve_token`
   - Any contract interaction
2. Simulation should:
   - Use `eth_call` to dry-run the transaction
   - Verify the transaction won't revert
   - Estimate gas cost and report in USD
   - For swaps: report expected output amount and price impact
   - For transfers: verify sender has sufficient balance
3. Return simulation results before execution:
   ```typescript
   {
     simulation: {
       success: boolean;
       gasEstimate: string;
       gasCostUsd: string;
       expectedOutput?: string;
       priceImpact?: string;
       warnings: string[];
     }
   }
   ```
4. Add `dryRun` mode that only simulates without executing
5. Block execution if simulation fails (with override flag for advanced users)
6. Detect common failure reasons: insufficient balance, insufficient allowance, slippage exceeded

## Acceptance Criteria
- [ ] All write operations simulate by default
- [ ] Simulation results include gas cost in USD
- [ ] `dryRun` mode returns simulation without executing
- [ ] Failed simulations block execution
- [ ] Common failure reasons detected and reported
