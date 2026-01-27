// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IX402.sol";
import "./interfaces/IUSDs.sol";
import "./ToolRegistry.sol";

/**
 * @title X402CreditSystem
 * @author X402 Protocol
 * @notice Prepaid credit system for AI tool payments with yield accumulation
 * @dev Credits earn USDs auto-yield while deposited
 * 
 * Features:
 * - Deposit USDs to receive credits
 * - Credits accumulate USDs auto-yield
 * - Use credits for tool payments
 * - Withdraw remaining credits as USDs
 * - Bonus credits for large deposits
 * - Credit expiration for compliance
 * 
 * Credit System:
 * - 1 USDs = 1 Credit (base rate)
 * - Credits earn ~25% APY from USDs auto-yield
 * - Bulk deposit bonuses available
 * - Credits can be used across all registered tools
 * 
 * Yield Mechanism:
 * - USDs is a rebasing token (balance increases automatically)
 * - Contract opts into rebase on deployment
 * - User credits tracked via USDs internal credits system
 * - Yield distributed proportionally to all depositors
 */
contract X402CreditSystem is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable,
    IX402CreditSystem
{
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice USDs token address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Minimum deposit amount (1 USDs)
    uint256 public constant MIN_DEPOSIT = 1e18;

    /// @notice Large deposit threshold for bonus (1000 USDs)
    uint256 public constant LARGE_DEPOSIT_THRESHOLD = 1_000e18;

    /// @notice Bonus for large deposits in basis points (2%)
    uint256 public constant LARGE_DEPOSIT_BONUS_BPS = 200;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Tool Registry contract
    ToolRegistry public toolRegistry;

    /// @notice Platform wallet for receiving fees
    address public platformWallet;

    /// @notice Platform fee in basis points (5%)
    uint256 public platformFeeBps;

    /// @notice User credit information
    mapping(address => CreditInfo) public credits;

    /// @notice USDs internal credits for yield tracking
    /// @dev Credits in USDs system: balance = credits / creditsPerToken
    mapping(address => uint256) private _usdsCredits;

    /// @notice Total credits issued
    uint256 public totalCreditsIssued;

    /// @notice Total credits used
    uint256 public totalCreditsUsed;

    /// @notice Total deposits
    uint256 public totalDeposits;

    /// @notice Total withdrawals
    uint256 public totalWithdrawals;

    /// @notice Credit expiration period (0 = no expiration)
    uint256 public creditExpirationPeriod;

    /// @notice Storage gap for upgrades
    uint256[40] private __gap;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when bonus credits are issued
    event BonusCreditsIssued(address indexed user, uint256 amount);

    /// @notice Emitted when credits expire
    event CreditsExpired(address indexed user, uint256 amount);

    /// @notice Emitted when tool registry is updated
    event ToolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                             INITIALIZER
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the credit system
     * @param _toolRegistry Tool Registry contract address
     * @param _platformWallet Platform wallet address
     * @param _platformFeeBps Platform fee in basis points
     */
    function initialize(
        address _toolRegistry,
        address _platformWallet,
        uint256 _platformFeeBps
    ) public initializer {
        if (_toolRegistry == address(0)) revert InvalidAddress();
        if (_platformWallet == address(0)) revert InvalidAddress();
        if (_platformFeeBps > 1000) revert InvalidAmount(); // Max 10%

        __Ownable_init(msg.sender);
        __Pausable_init();

        toolRegistry = ToolRegistry(_toolRegistry);
        platformWallet = _platformWallet;
        platformFeeBps = _platformFeeBps;

        // Opt-in for USDs auto-yield
        IUSDs(USDS).rebaseOptIn();
    }

    /*//////////////////////////////////////////////////////////////
                              DEPOSITS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit USDs to receive credits
     * @param amount Amount of USDs to deposit
     * @dev Credits = amount + bonus (if applicable)
     * @dev Deposits earn USDs auto-yield
     */
    function deposit(uint256 amount) external override nonReentrant whenNotPaused {
        if (amount < MIN_DEPOSIT) revert InvalidAmount();

        // Transfer USDs from user
        IERC20(USDS).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate bonus for large deposits
        uint256 bonusCredits = 0;
        if (amount >= LARGE_DEPOSIT_THRESHOLD) {
            bonusCredits = (amount * LARGE_DEPOSIT_BONUS_BPS) / BPS_DENOMINATOR;
            emit BonusCreditsIssued(msg.sender, bonusCredits);
        }

        uint256 totalCredits = amount + bonusCredits;

        // Track USDs credits for rebasing
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 usdsCredits = amount * creditsPerToken;
        _usdsCredits[msg.sender] += usdsCredits;

        // Update user credits
        CreditInfo storage userCredits = credits[msg.sender];
        userCredits.deposited += amount;
        userCredits.lastUpdate = block.timestamp;

        // Update totals
        totalCreditsIssued += totalCredits;
        totalDeposits += amount;

        emit CreditsDeposited(msg.sender, amount, getCreditBalance(msg.sender));
    }

    /**
     * @notice Deposit USDs on behalf of another user
     * @param recipient User to receive credits
     * @param amount Amount to deposit
     */
    function depositFor(
        address recipient,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount < MIN_DEPOSIT) revert InvalidAmount();

        IERC20(USDS).safeTransferFrom(msg.sender, address(this), amount);

        uint256 bonusCredits = 0;
        if (amount >= LARGE_DEPOSIT_THRESHOLD) {
            bonusCredits = (amount * LARGE_DEPOSIT_BONUS_BPS) / BPS_DENOMINATOR;
            emit BonusCreditsIssued(recipient, bonusCredits);
        }

        uint256 totalCredits = amount + bonusCredits;

        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 usdsCredits = amount * creditsPerToken;
        _usdsCredits[recipient] += usdsCredits;

        CreditInfo storage userCredits = credits[recipient];
        userCredits.deposited += amount;
        userCredits.lastUpdate = block.timestamp;

        totalCreditsIssued += totalCredits;
        totalDeposits += amount;

        emit CreditsDeposited(recipient, amount, getCreditBalance(recipient));
    }

    /*//////////////////////////////////////////////////////////////
                            CREDIT USAGE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Use credits to pay for a tool
     * @param tool Tool name
     * @param amount Credit amount to use
     */
    function useCredits(
        string calldata tool,
        uint256 amount
    ) external override nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        uint256 balance = getCreditBalance(msg.sender);
        if (amount > balance) revert InvalidAmount();

        // Check expiration if set
        if (creditExpirationPeriod > 0) {
            CreditInfo storage userCredits = credits[msg.sender];
            if (block.timestamp > userCredits.lastUpdate + creditExpirationPeriod) {
                // Credits expired
                emit CreditsExpired(msg.sender, balance);
                revert NotAllowed();
            }
        }

        // Get tool info
        (address developer, uint256 price, ) = toolRegistry.getToolInfo(tool);
        if (developer == address(0)) revert NotAllowed();

        // Ensure sufficient credits for tool price
        if (amount < price) revert InvalidAmount();

        // Deduct credits
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 usdsCreditsToDeduct = amount * creditsPerToken;

        // Handle case where USDs credits may be slightly off due to rounding
        if (usdsCreditsToDeduct > _usdsCredits[msg.sender]) {
            usdsCreditsToDeduct = _usdsCredits[msg.sender];
        }
        _usdsCredits[msg.sender] -= usdsCreditsToDeduct;

        // Update user credits
        credits[msg.sender].creditsUsed += amount;
        credits[msg.sender].lastUpdate = block.timestamp;
        totalCreditsUsed += amount;

        // Calculate platform fee
        uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 developerAmount = amount - platformAmount;

        // Transfer to developer and platform
        IERC20(USDS).safeTransfer(developer, developerAmount);
        IERC20(USDS).safeTransfer(platformWallet, platformAmount);

        emit CreditsUsed(msg.sender, tool, amount);
    }

    /**
     * @notice Use credits for custom payment (not through registry)
     * @param recipient Payment recipient
     * @param amount Credit amount to use
     */
    function useCreditsForPayment(
        address recipient,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 balance = getCreditBalance(msg.sender);
        if (amount > balance) revert InvalidAmount();

        // Deduct credits
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 usdsCreditsToDeduct = amount * creditsPerToken;

        if (usdsCreditsToDeduct > _usdsCredits[msg.sender]) {
            usdsCreditsToDeduct = _usdsCredits[msg.sender];
        }
        _usdsCredits[msg.sender] -= usdsCreditsToDeduct;

        credits[msg.sender].creditsUsed += amount;
        credits[msg.sender].lastUpdate = block.timestamp;
        totalCreditsUsed += amount;

        // Calculate platform fee
        uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 recipientAmount = amount - platformAmount;

        // Transfer payments
        IERC20(USDS).safeTransfer(recipient, recipientAmount);
        IERC20(USDS).safeTransfer(platformWallet, platformAmount);

        emit CreditsUsed(msg.sender, "direct-payment", amount);
    }

    /*//////////////////////////////////////////////////////////////
                            WITHDRAWALS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Withdraw remaining credits as USDs
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external override nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 balance = getCreditBalance(msg.sender);
        if (amount > balance) revert InvalidAmount();

        // Deduct from USDs credits
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 usdsCreditsToDeduct = amount * creditsPerToken;

        if (usdsCreditsToDeduct > _usdsCredits[msg.sender]) {
            usdsCreditsToDeduct = _usdsCredits[msg.sender];
        }
        _usdsCredits[msg.sender] -= usdsCreditsToDeduct;

        // Update records
        credits[msg.sender].lastUpdate = block.timestamp;
        totalWithdrawals += amount;

        // Transfer USDs
        IERC20(USDS).safeTransfer(msg.sender, amount);

        emit CreditsWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Withdraw all remaining credits
     */
    function withdrawAll() external nonReentrant {
        uint256 balance = getCreditBalance(msg.sender);
        if (balance == 0) revert InvalidAmount();

        // Clear USDs credits
        _usdsCredits[msg.sender] = 0;

        // Update records
        credits[msg.sender].lastUpdate = block.timestamp;
        totalWithdrawals += balance;

        // Transfer USDs
        IERC20(USDS).safeTransfer(msg.sender, balance);

        emit CreditsWithdrawn(msg.sender, balance);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get user's current credit balance including yield
     * @param user User address
     * @return Current credit balance
     */
    function getCreditBalance(address user) public view override returns (uint256) {
        uint256 usdsCredits = _usdsCredits[user];
        if (usdsCredits == 0) return 0;

        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        return usdsCredits / creditsPerToken;
    }

    /**
     * @notice Get user's credit information
     * @param user User address
     * @return Full CreditInfo struct
     */
    function getCreditInfo(address user) external view returns (CreditInfo memory) {
        return credits[user];
    }

    /**
     * @notice Get total credits available (deposits - used)
     * @param user User address
     * @return Available credits
     */
    function getAvailableCredits(address user) external view returns (uint256) {
        return getCreditBalance(user);
    }

    /**
     * @notice Get yield earned by user
     * @param user User address
     * @return Yield earned in USDs
     */
    function getYieldEarned(address user) external view returns (uint256) {
        uint256 currentBalance = getCreditBalance(user);
        CreditInfo storage info = credits[user];

        if (currentBalance == 0) return 0;

        uint256 netDeposit = info.deposited - info.creditsUsed;
        if (currentBalance > netDeposit) {
            return currentBalance - netDeposit;
        }
        return 0;
    }

    /**
     * @notice Check if user's credits have expired
     * @param user User address
     * @return True if credits are expired
     */
    function areCreditsExpired(address user) external view returns (bool) {
        if (creditExpirationPeriod == 0) return false;

        CreditInfo storage info = credits[user];
        return block.timestamp > info.lastUpdate + creditExpirationPeriod;
    }

    /**
     * @notice Get contract statistics
     * @return _totalDeposits Total USDs deposited
     * @return _totalWithdrawals Total USDs withdrawn
     * @return _totalCreditsUsed Total credits used
     * @return _currentBalance Current USDs balance
     */
    function getStats() external view returns (
        uint256 _totalDeposits,
        uint256 _totalWithdrawals,
        uint256 _totalCreditsUsed,
        uint256 _currentBalance
    ) {
        return (
            totalDeposits,
            totalWithdrawals,
            totalCreditsUsed,
            IERC20(USDS).balanceOf(address(this))
        );
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update tool registry address
     * @param newRegistry New registry address
     */
    function setToolRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert InvalidAddress();

        address oldRegistry = address(toolRegistry);
        toolRegistry = ToolRegistry(newRegistry);

        emit ToolRegistryUpdated(oldRegistry, newRegistry);
    }

    /**
     * @notice Update platform wallet
     * @param newWallet New platform wallet address
     */
    function setPlatformWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert InvalidAddress();
        platformWallet = newWallet;
    }

    /**
     * @notice Update platform fee
     * @param newFeeBps New fee in basis points
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidAmount(); // Max 10%
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice Set credit expiration period
     * @param period Expiration period in seconds (0 = no expiration)
     */
    function setCreditExpirationPeriod(uint256 period) external onlyOwner {
        creditExpirationPeriod = period;
    }

    /**
     * @notice Issue bonus credits to a user (promotional)
     * @param user User address
     * @param amount Bonus credit amount
     */
    function issueBonusCredits(address user, uint256 amount) external onlyOwner {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        // Must have USDs to back the bonus
        uint256 balance = IERC20(USDS).balanceOf(address(this));
        if (balance < amount) revert InvalidAmount();

        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 usdsCredits = amount * creditsPerToken;
        _usdsCredits[user] += usdsCredits;

        credits[user].deposited += amount;
        credits[user].lastUpdate = block.timestamp;
        totalCreditsIssued += amount;

        emit BonusCreditsIssued(user, amount);
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Authorize upgrade (UUPS)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
