// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee;
        address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA, address tokenB,
        uint amountADesired, uint amountBDesired,
        uint amountAMin, uint amountBMin,
        address to, uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

contract TreasuryVault {
    error NotOwner();
    address public immutable owner;  // VendingMachine
    constructor(address _owner){ owner = _owner; }
    modifier onlyOwner(){ if (msg.sender != owner) revert NotOwner(); _; }

    function approve(IERC20 t, address spender, uint256 amt) external onlyOwner {
        t.approve(spender, amt);
    }

    function pull(IERC20 t, address to, uint256 amt) external onlyOwner {
        t.transfer(to, amt); // refunds / emergency / LP steps
    }

    function swapUSDCforHEU(
        ISwapRouter02 router, IERC20 usdc, IERC20 heu,
        uint24 fee, uint256 amountIn, uint256 minOut
    ) external onlyOwner returns (uint256 out) {
        usdc.approve(address(router), amountIn);
        out = router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(usdc),
                tokenOut: address(heu),
                fee: fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function addLiquidityV2(
        IUniswapV2Router02 router, IERC20 token, IERC20 heu,
        uint256 amountToken, uint256 amountHeu, uint256 minToken, uint256 minHeu
    ) external onlyOwner returns (uint256 liq) {
        token.approve(address(router), amountToken);
        heu.approve(address(router), amountHeu);
        (, , liq) = router.addLiquidity(
            address(token), address(heu),
            amountToken, amountHeu,
            minToken, minHeu,
            address(0),                 // burn LP
            block.timestamp + 15 minutes
        );
    }
}
