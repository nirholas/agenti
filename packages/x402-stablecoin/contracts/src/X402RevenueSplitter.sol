// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IUSDs.sol";

/**
 * @title X402RevenueSplitter
 * @author X402 Protocol
 * @notice Splits payment revenue between developers and the platform
 * @dev Handles USDs payments with automatic yield accumulation
 * 
 * Features:
 * - Configurable platform fee (default 20%)
 * - Developer receives remainder after platform fee
 * - USDs opt-in for auto-yield on accumulated fees
 * - Batch payment support
 */
contract X402RevenueSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Payment structure for batch operations
    struct Payment {
        address developer;
        uint256 amount;
        string memo;
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Maximum platform fee (50%)
    uint256 public constant MAX_PLATFORM_FEE_BPS = 5000;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice USDs token address
    address public immutable usds;

    /// @notice Platform wallet that receives fees
    address public platformWallet;

    /// @notice Platform fee in basis points
    uint256 public platformFeeBps;

    /// @notice Accumulated developer balances
    mapping(address => uint256) public developerBalances;

    /// @notice Total developer balance (for accounting)
    uint256 public totalDeveloperBalance;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PaymentProcessed(
        address indexed payer,
        address indexed developer,
        uint256 totalAmount,
        uint256 developerAmount,
        uint256 platformAmount,
        string memo
    );

    event DeveloperWithdrawal(
        address indexed developer,
        uint256 amount
    );

    event PlatformFeeUpdated(
        uint256 oldFeeBps,
        uint256 newFeeBps
    );

    event PlatformWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the revenue splitter
     * @param _usds USDs token address
     * @param _platformWallet Platform wallet address
     * @param _platformFeeBps Platform fee in basis points
     */
    constructor(
        address _usds,
        address _platformWallet,
        uint256 _platformFeeBps
    ) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_platformFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");

        usds = _usds;
        platformWallet = _platformWallet;
        platformFeeBps = _platformFeeBps;

        // Opt into USDs rebase for auto-yield
        if (_usds != address(0)) {
            try IUSDs(_usds).rebaseOptIn() {} catch {}
        }
    }

    /*//////////////////////////////////////////////////////////////
                          PAYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Process a single payment, splitting between developer and platform
     * @param developer The developer receiving the majority share
     * @param amount Total payment amount
     * @param memo Optional memo for the payment
     */
    function processPayment(
        address developer,
        uint256 amount,
        string calldata memo
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(developer != address(0), "Invalid developer");

        // Transfer USDs from payer
        IERC20(usds).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate split
        uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 developerAmount = amount - platformAmount;

        // Transfer to developer immediately
        IERC20(usds).safeTransfer(developer, developerAmount);

        // Transfer platform fee
        if (platformAmount > 0) {
            IERC20(usds).safeTransfer(platformWallet, platformAmount);
        }

        emit PaymentProcessed(msg.sender, developer, amount, developerAmount, platformAmount, memo);
    }

    /**
     * @notice Process multiple payments in a single transaction
     * @param payments Array of Payment structs
     */
    function processBatchPayments(Payment[] calldata payments) external nonReentrant {
        uint256 totalPlatformAmount = 0;
        uint256 totalAmount = 0;

        // Calculate total amount needed
        for (uint256 i = 0; i < payments.length; i++) {
            require(payments[i].amount > 0, "Amount must be > 0");
            require(payments[i].developer != address(0), "Invalid developer");
            totalAmount += payments[i].amount;
        }

        // Transfer total from payer
        IERC20(usds).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Process each payment
        for (uint256 i = 0; i < payments.length; i++) {
            uint256 platformAmount = (payments[i].amount * platformFeeBps) / BPS_DENOMINATOR;
            uint256 developerAmount = payments[i].amount - platformAmount;

            // Transfer to developer
            IERC20(usds).safeTransfer(payments[i].developer, developerAmount);

            totalPlatformAmount += platformAmount;

            emit PaymentProcessed(
                msg.sender,
                payments[i].developer,
                payments[i].amount,
                developerAmount,
                platformAmount,
                payments[i].memo
            );
        }

        // Transfer all platform fees at once
        if (totalPlatformAmount > 0) {
            IERC20(usds).safeTransfer(platformWallet, totalPlatformAmount);
        }
    }

    /**
     * @notice Split a payment and hold developer funds (for accumulation)
     * @param developer The developer receiving the majority share
     * @param amount Total payment amount
     */
    function splitPayment(
        address developer,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(developer != address(0), "Invalid developer");

        // Transfer USDs from payer
        IERC20(usds).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate split
        uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 developerAmount = amount - platformAmount;

        // Credit developer balance (held for yield)
        developerBalances[developer] += developerAmount;
        totalDeveloperBalance += developerAmount;

        // Transfer platform fee immediately
        if (platformAmount > 0) {
            IERC20(usds).safeTransfer(platformWallet, platformAmount);
        }

        emit PaymentProcessed(msg.sender, developer, amount, developerAmount, platformAmount, "");
    }

    /**
     * @notice Withdraw accumulated developer balance
     */
    function withdrawDeveloperBalance() external nonReentrant {
        uint256 balance = developerBalances[msg.sender];
        require(balance > 0, "No balance");

        developerBalances[msg.sender] = 0;
        totalDeveloperBalance -= balance;

        IERC20(usds).safeTransfer(msg.sender, balance);

        emit DeveloperWithdrawal(msg.sender, balance);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update platform fee
     * @param newFeeBps New fee in basis points
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");

        uint256 oldFeeBps = platformFeeBps;
        platformFeeBps = newFeeBps;

        emit PlatformFeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Update platform wallet
     * @param newWallet New platform wallet address
     */
    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet");

        address oldWallet = platformWallet;
        platformWallet = newWallet;

        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculate the split for a given amount
     * @param amount Total amount to split
     * @return developerAmount Amount the developer receives
     * @return platformAmount Amount the platform receives
     */
    function calculateSplit(uint256 amount) 
        external 
        view 
        returns (uint256 developerAmount, uint256 platformAmount) 
    {
        platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        developerAmount = amount - platformAmount;
    }

    /**
     * @notice Get the current yield earned on accumulated balances
     * @dev Compares actual token balance vs tracked balances
     * @return yieldAmount Extra USDs from rebasing
     */
    function getAccumulatedYield() external view returns (uint256 yieldAmount) {
        uint256 actualBalance = IERC20(usds).balanceOf(address(this));
        if (actualBalance > totalDeveloperBalance) {
            yieldAmount = actualBalance - totalDeveloperBalance;
        }
    }
}
