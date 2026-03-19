# VibeSwap

VibeSwap is a thin, in-memory model of Uniswap V2-style constant-product AMM behavior. It maintains
per-wallet token balances, per-pair reserves, and LP balances, then applies the same fee-adjusted
swap math and liquidity mint/burn formulas as Uniswap V2.

## Quick test

Run the Boost.Test-based unit test if your full dependency stack is installed.

```sh
cmake -S . -B build
cmake --build build --target mptest
ctest --test-dir build -R VibeSwapTest --output-on-failure
```

