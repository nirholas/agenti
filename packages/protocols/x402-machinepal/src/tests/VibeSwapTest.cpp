#include "MachinePalCommon.h"
#include "vibemarket/VibeSwap.h"

#include <boost/test/unit_test.hpp>


#define BOOST_TEST_MODULE VibeSwapTest


BOOST_AUTO_TEST_CASE(add_liquidity_and_swap) {
    VibeSwap swap;
    using Amount = TokenAmount;
    VibeSwap::Token tokenA = "TOKENA";
    VibeSwap::Token tokenB = "TOKENB";
    EthAddress provider("0x0000000000000000000000000000000000000001");
    EthAddress trader("0x0000000000000000000000000000000000000002");

    swap.mintToken(provider, tokenA, Amount(u256(100000)));
    swap.mintToken(provider, tokenB, Amount(u256(100000)));
    swap.mintToken(trader, tokenA, Amount(u256(10000)));

    auto result = swap.addLiquidity(provider, tokenA, tokenB,
                                    Amount(u256(50000)), Amount(u256(50000)), Amount(u256(1)), Amount(u256(1)));

    BOOST_TEST(result.amountA == Amount(u256(50000)));
    BOOST_TEST(result.amountB == Amount(u256(50000)));
    BOOST_TEST(result.liquidity > Amount(u256(0)));

    auto reserves = swap.getReserves(tokenA, tokenB);
    BOOST_TEST(reserves.first == Amount(u256(50000)));
    BOOST_TEST(reserves.second == Amount(u256(50000)));

    auto amounts = swap.swapExactTokensForTokens(trader, Amount(u256(1000)), Amount(u256(1)), {tokenA, tokenB}, trader);

    BOOST_TEST(amounts.size() == 2);
    BOOST_TEST(amounts.front() == Amount(u256(1000)));
    BOOST_TEST(amounts.back() > Amount(u256(0)));
    BOOST_TEST(swap.balanceOf(trader, tokenA) == Amount(u256(9000)));
    BOOST_TEST(swap.balanceOf(trader, tokenB) == amounts.back());
}
