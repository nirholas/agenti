// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaymentRouter
 * @notice Routes any token payments through DEX aggregators, delivering USDC to recipients
 * @dev Integrates with 0x, 1inch, and other swap aggregators
 */
contract PaymentRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // USDC token address (chain-specific)
    IERC20 public immutable USDC;
    
    // Platform fee in basis points (30 = 0.3%)
    uint256 public platformFeeBps = 30;
    uint256 public constant MAX_FEE_BPS = 100; // 1% max
    
    // Fee recipient
    address public feeRecipient;
    
    // Approved swap aggregator contracts
    mapping(address => bool) public approvedAggregators;

    // Events
    event PaymentProcessed(
        address indexed sender,
        address indexed recipient,
        address inputToken,
        uint256 inputAmount,
        uint256 outputAmount
    );
    
    event FeeCollected(
        address indexed recipient,
        uint256 amount
    );
    
    event AggregatorUpdated(address indexed aggregator, bool approved);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    constructor(
        address _usdc,
        address _feeRecipient,
        address[] memory _initialAggregators
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        USDC = IERC20(_usdc);
        feeRecipient = _feeRecipient;
        
        for (uint256 i = 0; i < _initialAggregators.length; i++) {
            approvedAggregators[_initialAggregators[i]] = true;
            emit AggregatorUpdated(_initialAggregators[i], true);
        }
    }

    /**
     * @notice Pay with native ETH, swap to USDC, send to recipient
     * @param recipient The address to receive USDC
     * @param minOutput Minimum USDC output (slippage protection)
     * @param aggregator The swap aggregator to use
     * @param swapData Encoded swap data for the aggregator
     */
    function payWithETH(
        address recipient,
        uint256 minOutput,
        address aggregator,
        bytes calldata swapData
    ) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "No ETH sent");
        require(recipient != address(0), "Invalid recipient");
        require(approvedAggregators[aggregator], "Aggregator not approved");

        uint256 usdcBefore = USDC.balanceOf(address(this));

        // Execute swap through aggregator
        (bool success, ) = aggregator.call{value: msg.value}(swapData);
        require(success, "Swap failed");

        uint256 usdcReceived = USDC.balanceOf(address(this)) - usdcBefore;
        require(usdcReceived >= minOutput, "Slippage exceeded");

        // Calculate and collect fee
        uint256 fee = (usdcReceived * platformFeeBps) / 10000;
        uint256 recipientAmount = usdcReceived - fee;

        // Transfer USDC to recipient
        USDC.safeTransfer(recipient, recipientAmount);
        
        // Transfer fee
        if (fee > 0) {
            USDC.safeTransfer(feeRecipient, fee);
            emit FeeCollected(feeRecipient, fee);
        }

        emit PaymentProcessed(msg.sender, recipient, address(0), msg.value, recipientAmount);
        
        return recipientAmount;
    }

    /**
     * @notice Pay with ERC20 token, swap to USDC, send to recipient
     * @param inputToken The token to pay with
     * @param inputAmount Amount of input token
     * @param recipient The address to receive USDC
     * @param minOutput Minimum USDC output (slippage protection)
     * @param aggregator The swap aggregator to use
     * @param swapData Encoded swap data for the aggregator
     */
    function swapAndPay(
        address inputToken,
        uint256 inputAmount,
        address recipient,
        uint256 minOutput,
        address aggregator,
        bytes calldata swapData
    ) external nonReentrant returns (uint256) {
        require(inputAmount > 0, "No tokens sent");
        require(recipient != address(0), "Invalid recipient");
        require(approvedAggregators[aggregator], "Aggregator not approved");

        // Transfer input tokens from sender
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);
        
        // Approve aggregator to spend tokens
        IERC20(inputToken).forceApprove(aggregator, inputAmount);

        uint256 usdcBefore = USDC.balanceOf(address(this));

        // Execute swap through aggregator
        (bool success, ) = aggregator.call(swapData);
        require(success, "Swap failed");

        // Reset approval
        IERC20(inputToken).forceApprove(aggregator, 0);

        uint256 usdcReceived = USDC.balanceOf(address(this)) - usdcBefore;
        require(usdcReceived >= minOutput, "Slippage exceeded");

        // Calculate and collect fee
        uint256 fee = (usdcReceived * platformFeeBps) / 10000;
        uint256 recipientAmount = usdcReceived - fee;

        // Transfer USDC to recipient
        USDC.safeTransfer(recipient, recipientAmount);
        
        // Transfer fee
        if (fee > 0) {
            USDC.safeTransfer(feeRecipient, fee);
            emit FeeCollected(feeRecipient, fee);
        }

        emit PaymentProcessed(msg.sender, recipient, inputToken, inputAmount, recipientAmount);
        
        return recipientAmount;
    }

    /**
     * @notice Direct USDC payment (no swap needed)
     * @param amount Amount of USDC to send
     * @param recipient The address to receive USDC
     */
    function payWithUSDC(
        uint256 amount,
        address recipient
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "No USDC sent");
        require(recipient != address(0), "Invalid recipient");

        // Transfer USDC from sender
        USDC.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate and collect fee
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 recipientAmount = amount - fee;

        // Transfer USDC to recipient
        USDC.safeTransfer(recipient, recipientAmount);
        
        // Transfer fee
        if (fee > 0) {
            USDC.safeTransfer(feeRecipient, fee);
            emit FeeCollected(feeRecipient, fee);
        }

        emit PaymentProcessed(msg.sender, recipient, address(USDC), amount, recipientAmount);
        
        return recipientAmount;
    }

    // ============ Admin Functions ============

    function setAggregator(address aggregator, bool approved) external onlyOwner {
        approvedAggregators[aggregator] = approved;
        emit AggregatorUpdated(aggregator, approved);
    }

    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    // Emergency token recovery
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    receive() external payable {}
}
