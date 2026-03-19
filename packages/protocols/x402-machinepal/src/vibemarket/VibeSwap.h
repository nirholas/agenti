#pragma once

#include "MachinePalCommon.h"
#include "crypto/EthAddress.h"
#include "crypto/TokenAmount.h"

// VibeSwap is a thin, in-memory Uniswap V2-style model. It tracks wallet balances for tokens
// and LP balances for each pair, then applies the same constant-product (x*y=k) math used by
// Uniswap V2 when adding liquidity and swapping:
// - Pairs are identified by sorted token order (token0/token1). Reserves are stored in that order.
// - Adding liquidity mints LP tokens proportional to contributions; the first mint locks
//   MINIMUM_LIQUIDITY to the burn address, matching Uniswap V2 behavior.
// - Removing liquidity burns LP tokens and returns proportional reserves, respecting minimums.
// - Swaps apply the 0.3% fee (997/1000), compute hop-by-hop amounts for a path, and update reserves.
// - The model only moves balances within this instance; it does not touch any on-chain state.
class VibeSwap {
public:
    // Ethereum-style token symbol/identifier used by this in-memory model.
    using Token = std::string;

    // Result of addLiquidity, matching Uniswap V2 behavior (actual amounts deposited + LP minted).
    struct AddLiquidityResult {
        TokenAmount amountA;
        TokenAmount amountB;
        TokenAmount liquidity;
    };

    // Result of removeLiquidity, matching Uniswap V2 behavior (amounts returned).
    struct RemoveLiquidityResult {
        TokenAmount amountA;
        TokenAmount amountB;
    };

    // Snapshot of a pair's state (sorted tokens, reserves, and total LP supply).
    struct PairSnapshot {
        Token token0;
        Token token1;
        EthAddress contractAddress;
        TokenAmount reserve0;
        TokenAmount reserve1;
        TokenAmount totalSupply;
    };

    // Construct an empty swap model with no pairs and no balances.
    VibeSwap();

    // Mint fungible tokens into a wallet (testing/funding helper; not a Uniswap V2 factory action).
    void mintToken(const EthAddress &to, const Token &token, const TokenAmount &amount);
    // Return ERC20-like balance for a wallet and token.
    TokenAmount balanceOf(const EthAddress &owner, const Token &token) const;
    // Return LP token balance for a wallet for the (tokenA, tokenB) pair.
    TokenAmount lpBalanceOf(const EthAddress &owner, const Token &tokenA, const Token &tokenB) const;

    // Read-only pair state, with tokens in sorted order.
    PairSnapshot getPairSnapshot(const Token &tokenA, const Token &tokenB) const;
    // Convenience accessor for reserves in sorted order (token0, token1).
    std::pair<TokenAmount, TokenAmount> getReserves(const Token &tokenA, const Token &tokenB) const;

    // Add liquidity following Uniswap V2 math: initial mint uses sqrt(amountA*amountB) - MINIMUM_LIQUIDITY,
    // subsequent mints are proportional to reserves. Reverts if min constraints are not met.
    AddLiquidityResult addLiquidity(const EthAddress &provider,
                                   const Token &tokenA,
                                   const Token &tokenB,
                                   const TokenAmount &amountADesired,
                                   const TokenAmount &amountBDesired,
                                   const TokenAmount &amountAMin,
                                   const TokenAmount &amountBMin);

    // Remove liquidity, burning LP tokens and returning underlying tokens subject to min constraints.
    RemoveLiquidityResult removeLiquidity(const EthAddress &provider,
                                          const Token &tokenA,
                                          const Token &tokenB,
                                          const TokenAmount &liquidity,
                                          const TokenAmount &amountAMin,
                                          const TokenAmount &amountBMin);

    // Swap an exact input amount across the path; returns all hop amounts and credits `to`.
    std::vector<TokenAmount> swapExactTokensForTokens(const EthAddress &trader,
                                               const TokenAmount &amountIn,
                                               const TokenAmount &amountOutMin,
                                               const std::vector<Token> &path,
                                               const EthAddress &to);

    // Swap to receive an exact output amount across the path; debits `trader` up to amountInMax.
    std::vector<TokenAmount> swapTokensForExactTokens(const EthAddress &trader,
                                               const TokenAmount &amountOut,
                                               const TokenAmount &amountInMax,
                                               const std::vector<Token> &path,
                                               const EthAddress &to);

    // Uniswap V2 quote() helper: amountB = amountA * reserveB / reserveA.
    static TokenAmount quote(const TokenAmount &amountA, const TokenAmount &reserveA, const TokenAmount &reserveB);
    // Uniswap V2 getAmountOut with 0.3% fee (997/1000): amountOut = ...
    // Fee-adjusted invariant: (reserveIn * reserveOut) <= (reserveIn + amountInWithFee) * (reserveOut - amountOut),
    // where amountInWithFee = amountIn * 997 / 1000. This preserves x*y=k after fees are applied.
    TokenAmount getAmountOut(const TokenAmount &amountIn, const TokenAmount &reserveIn, const TokenAmount &reserveOut) const;
    // Uniswap V2 getAmountIn with 0.3% fee (997/1000): amountIn = ...
    TokenAmount getAmountIn(const TokenAmount &amountOut, const TokenAmount &reserveIn, const TokenAmount &reserveOut) const;

    // Per-hop outputs for a path given an exact input.
    std::vector<TokenAmount> getAmountsOut(const TokenAmount &amountIn, const std::vector<Token> &path) const;
    // Per-hop inputs for a path to achieve an exact output.
    std::vector<TokenAmount> getAmountsIn(const TokenAmount &amountOut, const std::vector<Token> &path) const;

private:
    // Pair data stored in sorted token order with LP balances for providers.
    // Math notes (Uniswap V2 style): reserves are (reserve0, reserve1) for (token0, token1) and
    // define the constant-product invariant k = reserve0 * reserve1. Liquidity (LP) supply tracks
    // pro-rata ownership of reserves. On first mint, liquidity = sqrt(amount0 * amount1)
    // minus MINIMUM_LIQUIDITY, which is locked to the burn address. On subsequent mints,
    // liquidity = min(amount0 * totalSupply / reserve0, amount1 * totalSupply / reserve1).
    // On burn, amounts returned are amount0 = liquidity * reserve0 / totalSupply and
    // amount1 = liquidity * reserve1 / totalSupply (after which totalSupply decreases).
    struct Pair {
        Token token0;
        Token token1;
        EthAddress contractAddress;
        TokenAmount reserve0{};
        TokenAmount reserve1{};
        TokenAmount totalSupply{};
        std::map<EthAddress, TokenAmount> lpBalances;
    };

    // Uniswap V2 fee parameters (0.3%) and minimum locked liquidity.
    static constexpr uint32_t kFeeNumerator = 997;
    static constexpr uint32_t kFeeDenominator = 1000;
    static constexpr uint32_t kMinimumLiquidity = 1000;
    // Burn address for the permanently locked MINIMUM_LIQUIDITY.
    static EthAddress burnAddress();

    // Sort tokens deterministically (mirrors Uniswap V2 token0/token1).
    static std::pair<Token, Token> sortTokens(const Token &tokenA, const Token &tokenB);
    // Integer square-root used for initial liquidity minting.
    static TokenAmount integerSqrt(const TokenAmount &value);

    static EthAddress makePairAddress(const Token &token0, const Token &token1);

    // Deterministic key for pair map (token0, token1).
    std::string pairKey(const Token &token0, const Token &token1) const;
    // Get or create a pair in sorted order.
    Pair &getOrCreatePair(const Token &tokenA, const Token &tokenB);
    // Get an existing pair or throw if not present.
    Pair &getPairChecked(const Token &tokenA, const Token &tokenB);
    const Pair &getPairChecked(const Token &tokenA, const Token &tokenB) const;

    // Validate wallet balance before debiting.
    void ensureBalance(const EthAddress &owner, const Token &token, const TokenAmount &amount) const;
    // Move tokens from wallet to pool.
    void debit(const EthAddress &owner, const Token &token, const TokenAmount &amount);
    // Move tokens from pool to wallet.
    void credit(const EthAddress &owner, const Token &token, const TokenAmount &amount);

    // Execute swap given precomputed hop amounts (path size N yields amounts size N).
    std::vector<TokenAmount> swapWithKnownAmounts(const EthAddress &trader,
                                           const std::vector<TokenAmount> &amounts,
                                           const std::vector<Token> &path,
                                           const EthAddress &to);

    // Map of pairKey -> Pair state, and wallet balances per token.
    std::map<std::string, Pair> pairs_;
    std::map<EthAddress, std::map<Token, TokenAmount>> balances_;
};
