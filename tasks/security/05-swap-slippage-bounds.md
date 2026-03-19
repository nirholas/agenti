# Task: Add Slippage Bounds and Validation to All Swap Tools

## Priority: HIGH

## Context
Swap tools in `src/evm/modules/swap/tools.ts` accept unbounded slippage values. Negative slippage makes `minAmountOut` higher than `amountOut` (always fails). Extreme values (>50%) expose users to sandwich attacks.

## Requirements
1. Add Zod validation: `z.number().min(0.01).max(50).default(1)` for all slippage parameters
2. Validate that `minAmountOut < expectedAmountOut` before submitting transactions
3. Add a warning in the tool response when slippage > 5% (include the dollar value at risk)
4. Validate that `amount > 0` for all transfer and swap operations
5. Apply to all swap functions: Uniswap V2, V3, SushiSwap, and any other DEX integrations
6. Add gas limit caps (e.g., 500,000 gas for simple swaps, 1,000,000 for multi-hop)

## Acceptance Criteria
- [ ] Slippage bounded to 0.01–50% across all swap tools
- [ ] Positive amount validation on all financial operations
- [ ] Gas limit caps applied
- [ ] High-slippage warning in response
- [ ] Tests for boundary conditions
