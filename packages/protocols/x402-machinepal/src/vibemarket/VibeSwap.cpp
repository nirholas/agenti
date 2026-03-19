//
// Created by kladko on 08/02/26.
//

#include "VibeSwap.h"

namespace {
std::string toString(const VibeSwap::Token &token) {
    return token;
}

u256 toU256(const TokenAmount &value) {
    return value.value();
}

TokenAmount fromU256(const u256 &value) {
    return TokenAmount(value);
}
}

VibeSwap::VibeSwap() = default;

void VibeSwap::mintToken(const EthAddress &to, const Token &token, const TokenAmount &amount) {
    if (token.empty()) {
        throw std::invalid_argument("Token cannot be empty");
    }
    balances_[to][token] = fromU256(toU256(balances_[to][token]) + toU256(amount));
}

TokenAmount VibeSwap::balanceOf(const EthAddress &owner, const Token &token) const {
    auto ownerIt = balances_.find(owner);
    if (ownerIt == balances_.end()) {
        return TokenAmount();
    }
    auto tokenIt = ownerIt->second.find(token);
    if (tokenIt == ownerIt->second.end()) {
        return TokenAmount();
    }
    return tokenIt->second;
}

TokenAmount VibeSwap::lpBalanceOf(const EthAddress &owner, const Token &tokenA, const Token &tokenB) const {
    const auto &pair = getPairChecked(tokenA, tokenB);
    auto lpIt = pair.lpBalances.find(owner);
    if (lpIt == pair.lpBalances.end()) {
        return TokenAmount();
    }
    return lpIt->second;
}

VibeSwap::PairSnapshot VibeSwap::getPairSnapshot(const Token &tokenA, const Token &tokenB) const {
    const auto &pair = getPairChecked(tokenA, tokenB);
    return {pair.token0, pair.token1, pair.contractAddress, pair.reserve0, pair.reserve1, pair.totalSupply};
}

std::pair<TokenAmount, TokenAmount> VibeSwap::getReserves(const Token &tokenA, const Token &tokenB) const {
    const auto &pair = getPairChecked(tokenA, tokenB);
    return {pair.reserve0, pair.reserve1};
}

VibeSwap::AddLiquidityResult VibeSwap::addLiquidity(const EthAddress &provider,
                                                    const Token &tokenA,
                                                    const Token &tokenB,
                                                    const TokenAmount &amountADesired,
                                                    const TokenAmount &amountBDesired,
                                                    const TokenAmount &amountAMin,
                                                    const TokenAmount &amountBMin) {
    if (toU256(amountADesired) == 0 || toU256(amountBDesired) == 0) {
        throw std::invalid_argument("Desired amounts must be positive");
    }

    auto [token0, token1] = sortTokens(tokenA, tokenB);
    auto &pair = getOrCreatePair(token0, token1);

    u256 amount0Desired = (tokenA == token0) ? toU256(amountADesired) : toU256(amountBDesired);
    u256 amount1Desired = (tokenA == token0) ? toU256(amountBDesired) : toU256(amountADesired);
    u256 amount0Min = (tokenA == token0) ? toU256(amountAMin) : toU256(amountBMin);
    u256 amount1Min = (tokenA == token0) ? toU256(amountBMin) : toU256(amountAMin);

    u256 amount0 = 0;
    u256 amount1 = 0;
    u256 liquidity = 0;
    bool isFirstMint = (toU256(pair.totalSupply) == 0);

    if (isFirstMint) {
        amount0 = amount0Desired;
        amount1 = amount1Desired;
        if (amount0 < amount0Min || amount1 < amount1Min) {
            throw std::runtime_error("Insufficient amounts for initial liquidity");
        }
        u256 rootK = toU256(integerSqrt(fromU256(amount0 * amount1)));
        if (rootK <= kMinimumLiquidity) {
            throw std::runtime_error("Insufficient liquidity minted");
        }
        liquidity = rootK - kMinimumLiquidity;
    } else {
        u256 reserve0 = toU256(pair.reserve0);
        u256 reserve1 = toU256(pair.reserve1);
        u256 amount1Optimal = toU256(quote(fromU256(amount0Desired), fromU256(reserve0), fromU256(reserve1)));
        if (amount1Optimal <= amount1Desired) {
            if (amount1Optimal < amount1Min) {
                throw std::runtime_error("Insufficient amount1 provided");
            }
            amount0 = amount0Desired;
            amount1 = amount1Optimal;
        } else {
            u256 amount0Optimal = toU256(quote(fromU256(amount1Desired), fromU256(reserve1), fromU256(reserve0)));
            if (amount0Optimal < amount0Min) {
                throw std::runtime_error("Insufficient amount0 provided");
            }
            amount0 = amount0Optimal;
            amount1 = amount1Desired;
        }

        u256 totalSupply = toU256(pair.totalSupply);
        u256 liquidity0 = (amount0 * totalSupply) / reserve0;
        u256 liquidity1 = (amount1 * totalSupply) / reserve1;
        liquidity = std::min(liquidity0, liquidity1);
        if (liquidity == 0) {
            throw std::runtime_error("Insufficient liquidity minted");
        }
    }

    ensureBalance(provider, token0, fromU256(amount0));
    ensureBalance(provider, token1, fromU256(amount1));
    debit(provider, token0, fromU256(amount0));
    debit(provider, token1, fromU256(amount1));

    if (isFirstMint) {
        pair.totalSupply = fromU256(liquidity + kMinimumLiquidity);
        auto burnBalance = toU256(pair.lpBalances[burnAddress()]);
        pair.lpBalances[burnAddress()] = fromU256(burnBalance + kMinimumLiquidity);
    } else {
        pair.totalSupply = fromU256(toU256(pair.totalSupply) + liquidity);
    }

    pair.reserve0 = fromU256(toU256(pair.reserve0) + amount0);
    pair.reserve1 = fromU256(toU256(pair.reserve1) + amount1);
    pair.lpBalances[provider] = fromU256(toU256(pair.lpBalances[provider]) + liquidity);

    u256 amountA = (tokenA == token0) ? amount0 : amount1;
    u256 amountB = (tokenA == token0) ? amount1 : amount0;
    return {fromU256(amountA), fromU256(amountB), fromU256(liquidity)};
}

VibeSwap::RemoveLiquidityResult VibeSwap::removeLiquidity(const EthAddress &provider,
                                                          const Token &tokenA,
                                                          const Token &tokenB,
                                                          const TokenAmount &liquidity,
                                                          const TokenAmount &amountAMin,
                                                          const TokenAmount &amountBMin) {
    if (toU256(liquidity) == 0) {
        throw std::invalid_argument("Liquidity must be positive");
    }

    auto &pair = getPairChecked(tokenA, tokenB);
    u256 totalSupply = toU256(pair.totalSupply);
    if (totalSupply == 0) {
        throw std::runtime_error("Pair has no liquidity");
    }

    auto lpIt = pair.lpBalances.find(provider);
    if (lpIt == pair.lpBalances.end() || toU256(lpIt->second) < toU256(liquidity)) {
        throw std::runtime_error("Insufficient LP balance");
    }

    u256 amount0 = (toU256(liquidity) * toU256(pair.reserve0)) / totalSupply;
    u256 amount1 = (toU256(liquidity) * toU256(pair.reserve1)) / totalSupply;
    if (amount0 == 0 || amount1 == 0) {
        throw std::runtime_error("Insufficient liquidity burned");
    }

    auto [token0, token1] = sortTokens(tokenA, tokenB);
    u256 amountA = (tokenA == token0) ? amount0 : amount1;
    u256 amountB = (tokenA == token0) ? amount1 : amount0;
    if (amountA < toU256(amountAMin) || amountB < toU256(amountBMin)) {
        throw std::runtime_error("Minimum amount constraints not met");
    }

    pair.reserve0 = fromU256(toU256(pair.reserve0) - amount0);
    pair.reserve1 = fromU256(toU256(pair.reserve1) - amount1);
    pair.totalSupply = fromU256(totalSupply - toU256(liquidity));
    lpIt->second = fromU256(toU256(lpIt->second) - toU256(liquidity));

    credit(provider, token0, fromU256(amount0));
    credit(provider, token1, fromU256(amount1));

    return {fromU256(amountA), fromU256(amountB)};
}

std::vector<TokenAmount> VibeSwap::swapExactTokensForTokens(const EthAddress &trader,
                                                                 const TokenAmount &amountIn,
                                                                 const TokenAmount &amountOutMin,
                                                                 const std::vector<Token> &path,
                                                                 const EthAddress &to) {
    auto amounts = getAmountsOut(amountIn, path);
    if (toU256(amounts.back()) < toU256(amountOutMin)) {
        throw std::runtime_error("Insufficient output amount");
    }
    return swapWithKnownAmounts(trader, amounts, path, to);
}

std::vector<TokenAmount> VibeSwap::swapTokensForExactTokens(const EthAddress &trader,
                                                                 const TokenAmount &amountOut,
                                                                 const TokenAmount &amountInMax,
                                                                 const std::vector<Token> &path,
                                                                 const EthAddress &to) {
    auto amounts = getAmountsIn(amountOut, path);
    if (toU256(amounts.front()) > toU256(amountInMax)) {
        throw std::runtime_error("Excessive input amount");
    }
    return swapWithKnownAmounts(trader, amounts, path, to);
}

TokenAmount VibeSwap::quote(const TokenAmount &amountA, const TokenAmount &reserveA, const TokenAmount &reserveB) {
    if (toU256(amountA) == 0) {
        throw std::invalid_argument("Amount must be positive");
    }
    if (toU256(reserveA) == 0 || toU256(reserveB) == 0) {
        throw std::invalid_argument("Reserves must be positive");
    }
    return fromU256((toU256(amountA) * toU256(reserveB)) / toU256(reserveA));
}

TokenAmount VibeSwap::getAmountOut(const TokenAmount &amountIn, const TokenAmount &reserveIn, const TokenAmount &reserveOut) const {
    if (toU256(amountIn) == 0) {
        throw std::invalid_argument("Amount in must be positive");
    }
    if (toU256(reserveIn) == 0 || toU256(reserveOut) == 0) {
        throw std::invalid_argument("Reserves must be positive");
    }

    u256 amountInWithFee = toU256(amountIn) * kFeeNumerator;
    u256 numerator = amountInWithFee * toU256(reserveOut);
    u256 denominator = toU256(reserveIn) * kFeeDenominator + amountInWithFee;
    return fromU256(numerator / denominator);
}

TokenAmount VibeSwap::getAmountIn(const TokenAmount &amountOut, const TokenAmount &reserveIn, const TokenAmount &reserveOut) const {
    if (toU256(amountOut) == 0) {
        throw std::invalid_argument("Amount out must be positive");
    }
    if (toU256(reserveIn) == 0 || toU256(reserveOut) == 0) {
        throw std::invalid_argument("Reserves must be positive");
    }
    if (toU256(amountOut) >= toU256(reserveOut)) {
        throw std::invalid_argument("Amount out exceeds reserves");
    }

    u256 numerator = toU256(reserveIn) * toU256(amountOut) * kFeeDenominator;
    u256 denominator = (toU256(reserveOut) - toU256(amountOut)) * kFeeNumerator;
    return fromU256(numerator / denominator + 1);
}

std::vector<TokenAmount> VibeSwap::getAmountsOut(const TokenAmount &amountIn, const std::vector<Token> &path) const {
    if (path.size() < 2) {
        throw std::invalid_argument("Path must have at least two tokens");
    }

    std::vector<TokenAmount> amounts(path.size());
    amounts[0] = amountIn;
    for (size_t i = 0; i + 1 < path.size(); ++i) {
        const auto &pair = getPairChecked(path[i], path[i + 1]);
        auto [token0, token1] = sortTokens(path[i], path[i + 1]);
        bool inputIsToken0 = (path[i] == token0);
        TokenAmount reserveIn = inputIsToken0 ? pair.reserve0 : pair.reserve1;
        TokenAmount reserveOut = inputIsToken0 ? pair.reserve1 : pair.reserve0;
        amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
    }
    return amounts;
}

std::vector<TokenAmount> VibeSwap::getAmountsIn(const TokenAmount &amountOut, const std::vector<Token> &path) const {
    if (path.size() < 2) {
        throw std::invalid_argument("Path must have at least two tokens");
    }

    std::vector<TokenAmount> amounts(path.size());
    amounts.back() = amountOut;
    for (size_t i = path.size() - 1; i > 0; --i) {
        const auto &pair = getPairChecked(path[i - 1], path[i]);
        auto [token0, token1] = sortTokens(path[i - 1], path[i]);
        bool inputIsToken0 = (path[i - 1] == token0);
        TokenAmount reserveIn = inputIsToken0 ? pair.reserve0 : pair.reserve1;
        TokenAmount reserveOut = inputIsToken0 ? pair.reserve1 : pair.reserve0;
        amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
    }
    return amounts;
}

std::pair<VibeSwap::Token, VibeSwap::Token> VibeSwap::sortTokens(const Token &tokenA, const Token &tokenB) {
    if (tokenA.empty() || tokenB.empty()) {
        throw std::invalid_argument("Token cannot be empty");
    }
    if (tokenA == tokenB) {
        throw std::invalid_argument("Tokens must be distinct");
    }
    return (tokenA < tokenB) ? std::make_pair(tokenA, tokenB) : std::make_pair(tokenB, tokenA);
}

TokenAmount VibeSwap::integerSqrt(const TokenAmount &value) {
    u256 rawValue = toU256(value);
    if (rawValue == 0) {
        return TokenAmount();
    }

    u256 low = 0;
    u256 high = 1;
    while (high * high <= rawValue) {
        high <<= 1;
    }

    while (low + 1 < high) {
        u256 mid = (low + high) / 2;
        if (mid * mid <= rawValue) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return fromU256(low);
}

std::string VibeSwap::pairKey(const Token &token0, const Token &token1) const {
    return toString(token0) + "|" + toString(token1);
}

EthAddress VibeSwap::makePairAddress(const Token &token0, const Token &token1) {
    std::string key = toString(token0) + "|" + toString(token1);
    std::hash<std::string> hasher;
    uint64_t h1 = hasher(key);
    uint64_t h2 = hasher("vibeswap:" + key);
    uint64_t h3 = hasher(key + ":vibeswap");

    std::array<uint8_t, 20> bytes{};
    for (size_t i = 0; i < 8; ++i) {
        bytes[i] = static_cast<uint8_t>((h1 >> (8 * (7 - i))) & 0xFF);
    }
    for (size_t i = 0; i < 8; ++i) {
        bytes[8 + i] = static_cast<uint8_t>((h2 >> (8 * (7 - i))) & 0xFF);
    }
    for (size_t i = 0; i < 4; ++i) {
        bytes[16 + i] = static_cast<uint8_t>((h3 >> (8 * (7 - i))) & 0xFF);
    }

    return EthAddress(bytes);
}

EthAddress VibeSwap::burnAddress() {
    static const EthAddress addr("0x0000000000000000000000000000000000000000");
    return addr;
}

VibeSwap::Pair &VibeSwap::getOrCreatePair(const Token &tokenA, const Token &tokenB) {
    auto [token0, token1] = sortTokens(tokenA, tokenB);
    auto key = pairKey(token0, token1);
    Pair pair{token0, token1, makePairAddress(token0, token1), TokenAmount(), TokenAmount(), TokenAmount(), {}};
    auto [it, inserted] = pairs_.emplace(key, std::move(pair));
    return it->second;
}

VibeSwap::Pair &VibeSwap::getPairChecked(const Token &tokenA, const Token &tokenB) {
    auto [token0, token1] = sortTokens(tokenA, tokenB);
    auto key = pairKey(token0, token1);
    auto it = pairs_.find(key);
    if (it == pairs_.end()) {
        throw std::runtime_error("Pair not found for tokens " + token0 + " and " + token1);
    }
    return it->second;
}

const VibeSwap::Pair &VibeSwap::getPairChecked(const Token &tokenA, const Token &tokenB) const {
    auto [token0, token1] = sortTokens(tokenA, tokenB);
    auto key = pairKey(token0, token1);
    auto it = pairs_.find(key);
    if (it == pairs_.end()) {
        throw std::runtime_error("Pair not found for tokens " + token0 + " and " + token1);
    }
    return it->second;
}

void VibeSwap::ensureBalance(const EthAddress &owner, const Token &token, const TokenAmount &amount) const {
    if (toU256(balanceOf(owner, token)) < toU256(amount)) {
        throw std::runtime_error("Insufficient balance for token " + token);
    }
}

void VibeSwap::debit(const EthAddress &owner, const Token &token, const TokenAmount &amount) {
    auto &balance = balances_[owner][token];
    if (toU256(balance) < toU256(amount)) {
        throw std::runtime_error("Insufficient balance for token " + token);
    }
    balance = fromU256(toU256(balance) - toU256(amount));
}

void VibeSwap::credit(const EthAddress &owner, const Token &token, const TokenAmount &amount) {
    balances_[owner][token] = fromU256(toU256(balances_[owner][token]) + toU256(amount));
}

std::vector<TokenAmount> VibeSwap::swapWithKnownAmounts(const EthAddress &trader,
                                                             const std::vector<TokenAmount> &amounts,
                                                             const std::vector<Token> &path,
                                                             const EthAddress &to) {
    if (path.size() < 2) {
        throw std::invalid_argument("Path must have at least two tokens");
    }
    if (amounts.size() != path.size()) {
        throw std::invalid_argument("Amounts/path size mismatch");
    }

    ensureBalance(trader, path.front(), amounts.front());
    debit(trader, path.front(), amounts.front());

    for (size_t i = 0; i + 1 < path.size(); ++i) {
        auto &pair = getPairChecked(path[i], path[i + 1]);
        auto [token0, token1] = sortTokens(path[i], path[i + 1]);
        bool inputIsToken0 = (path[i] == token0);
        u256 amountIn = toU256(amounts[i]);
        u256 amountOut = toU256(amounts[i + 1]);

        u256 reserveIn = inputIsToken0 ? toU256(pair.reserve0) : toU256(pair.reserve1);
        u256 reserveOut = inputIsToken0 ? toU256(pair.reserve1) : toU256(pair.reserve0);

        if (amountOut >= reserveOut) {
            throw std::runtime_error("Insufficient liquidity for swap");
        }

        reserveIn += amountIn;
        reserveOut -= amountOut;

        if (inputIsToken0) {
            pair.reserve0 = fromU256(reserveIn);
            pair.reserve1 = fromU256(reserveOut);
        } else {
            pair.reserve1 = fromU256(reserveIn);
            pair.reserve0 = fromU256(reserveOut);
        }
    }

    credit(to, path.back(), amounts.back());
    return amounts;
}
