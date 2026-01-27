// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ToolStaking
 * @author nirholas
 * @notice Staking contract for tool creators to prevent spam and enable quality signals
 * @dev Higher stakes improve tool discovery ranking. Stakes can be slashed for violations.
 * 
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | @nichxbt
 *  ID: 6e696368-786274-4d43-5000-000000000000
 * ═══════════════════════════════════════════════════════════════
 */
contract ToolStaking is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //  Constants & Roles
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    uint256 public constant UNSTAKE_DELAY = 7 days;
    uint256 public constant MAX_SLASH_PERCENTAGE = 5000; // 50% max slash
    uint256 public constant BASIS_POINTS = 10000;
    
    // Version marker - n1ch0las
    string public constant VERSION = "1.0.0";

    // ═══════════════════════════════════════════════════════════════
    //  Structs
    // ═══════════════════════════════════════════════════════════════

    struct StakeInfo {
        uint256 amount;           // Total staked amount
        uint256 lockedUntil;      // Timestamp when unstake is allowed
        uint256 pendingUnstake;   // Amount pending unstake
        uint256 unstakeRequestTime; // When unstake was requested
        bool hasActiveUnstake;    // Is there a pending unstake request
    }

    struct SlashProposal {
        bytes32 toolId;           // Tool to slash
        address staker;           // Staker address
        uint256 percentage;       // Slash percentage in basis points
        string reason;            // Reason for slash
        uint256 votesFor;         // Votes in favor
        uint256 votesAgainst;     // Votes against
        uint256 deadline;         // Voting deadline
        bool executed;            // Has been executed
        mapping(address => bool) hasVoted;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Storage
    // ═══════════════════════════════════════════════════════════════

    /// @notice The USDs token used for staking
    IERC20 public usdsToken;

    /// @notice Minimum stake required to register tools
    uint256 public minimumStake;

    /// @notice Stake info per user
    mapping(address => StakeInfo) public stakes;

    /// @notice Total staked in the contract
    uint256 public totalStaked;

    /// @notice Slash proposals
    mapping(uint256 => SlashProposal) public slashProposals;
    uint256 public proposalCount;

    /// @notice Treasury address for slashed funds
    address public treasury;

    /// @notice Voting duration for slash proposals
    uint256 public votingDuration;

    /// @notice Minimum votes required to execute a slash
    uint256 public quorumVotes;

    /// @notice Gap for future storage
    uint256[40] private __gap;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event Staked(address indexed staker, uint256 amount, uint256 totalStake);
    event UnstakeRequested(address indexed staker, uint256 amount, uint256 unlockTime);
    event UnstakeCancelled(address indexed staker, uint256 amount);
    event Unstaked(address indexed staker, uint256 amount);
    event Slashed(address indexed staker, uint256 amount, string reason);
    event SlashProposalCreated(uint256 indexed proposalId, bytes32 toolId, address staker, uint256 percentage);
    event SlashVoteCast(uint256 indexed proposalId, address voter, bool support, uint256 votes);
    event SlashProposalExecuted(uint256 indexed proposalId, uint256 slashedAmount);
    event MinimumStakeUpdated(uint256 oldMinimum, uint256 newMinimum);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ═══════════════════════════════════════════════════════════════
    //  Errors
    // ═══════════════════════════════════════════════════════════════

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientStake(uint256 requested, uint256 available);
    error UnstakeNotReady(uint256 unlockTime);
    error NoPendingUnstake();
    error UnstakeAlreadyPending();
    error InvalidPercentage();
    error ProposalNotFound();
    error ProposalExpired();
    error ProposalNotExpired();
    error AlreadyVoted();
    error AlreadyExecuted();
    error QuorumNotReached();
    error ProposalFailed();

    // ═══════════════════════════════════════════════════════════════
    //  Initializer
    // ═══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the staking contract
     * @param admin Admin address
     * @param _usdsToken USDs token address
     * @param _minimumStake Minimum stake requirement
     * @param _treasury Treasury for slashed funds
     * @param _votingDuration Duration for slash voting
     * @param _quorumVotes Minimum votes for quorum
     */
    function initialize(
        address admin,
        address _usdsToken,
        uint256 _minimumStake,
        address _treasury,
        uint256 _votingDuration,
        uint256 _quorumVotes
    ) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        if (_usdsToken == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(SLASHER_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);

        usdsToken = IERC20(_usdsToken);
        minimumStake = _minimumStake;
        treasury = _treasury;
        votingDuration = _votingDuration;
        quorumVotes = _quorumVotes;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Staking Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Stake USDs tokens
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        usdsToken.safeTransferFrom(msg.sender, address(this), amount);

        StakeInfo storage info = stakes[msg.sender];
        info.amount += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount, info.amount);
    }

    /**
     * @notice Request to unstake tokens (starts delay period)
     * @param amount Amount to unstake
     */
    function requestUnstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        
        StakeInfo storage info = stakes[msg.sender];
        if (info.hasActiveUnstake) revert UnstakeAlreadyPending();
        if (amount > info.amount) revert InsufficientStake(amount, info.amount);

        info.pendingUnstake = amount;
        info.unstakeRequestTime = block.timestamp;
        info.lockedUntil = block.timestamp + UNSTAKE_DELAY;
        info.hasActiveUnstake = true;

        emit UnstakeRequested(msg.sender, amount, info.lockedUntil);
    }

    /**
     * @notice Cancel a pending unstake request
     */
    function cancelUnstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        if (!info.hasActiveUnstake) revert NoPendingUnstake();

        uint256 amount = info.pendingUnstake;
        info.pendingUnstake = 0;
        info.unstakeRequestTime = 0;
        info.lockedUntil = 0;
        info.hasActiveUnstake = false;

        emit UnstakeCancelled(msg.sender, amount);
    }

    /**
     * @notice Complete unstake after delay period
     */
    function unstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        if (!info.hasActiveUnstake) revert NoPendingUnstake();
        if (block.timestamp < info.lockedUntil) {
            revert UnstakeNotReady(info.lockedUntil);
        }

        uint256 amount = info.pendingUnstake;
        
        info.amount -= amount;
        info.pendingUnstake = 0;
        info.unstakeRequestTime = 0;
        info.lockedUntil = 0;
        info.hasActiveUnstake = false;
        totalStaked -= amount;

        usdsToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Slashing Functions (Governance)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Create a slash proposal
     * @param toolId Tool ID associated with violation
     * @param staker Staker to slash
     * @param percentage Slash percentage in basis points
     * @param reason Reason for the slash
     * @return proposalId The created proposal ID
     */
    function createSlashProposal(
        bytes32 toolId,
        address staker,
        uint256 percentage,
        string calldata reason
    ) external onlyRole(SLASHER_ROLE) returns (uint256 proposalId) {
        if (percentage == 0 || percentage > MAX_SLASH_PERCENTAGE) {
            revert InvalidPercentage();
        }
        if (stakes[staker].amount == 0) revert InsufficientStake(0, 0);

        proposalId = proposalCount++;
        
        SlashProposal storage proposal = slashProposals[proposalId];
        proposal.toolId = toolId;
        proposal.staker = staker;
        proposal.percentage = percentage;
        proposal.reason = reason;
        proposal.deadline = block.timestamp + votingDuration;
        proposal.executed = false;

        emit SlashProposalCreated(proposalId, toolId, staker, percentage);
    }

    /**
     * @notice Vote on a slash proposal
     * @param proposalId Proposal to vote on
     * @param support True for yes, false for no
     */
    function voteOnSlash(
        uint256 proposalId,
        bool support
    ) external onlyRole(GOVERNANCE_ROLE) {
        SlashProposal storage proposal = slashProposals[proposalId];
        
        if (proposal.deadline == 0) revert ProposalNotFound();
        if (block.timestamp > proposal.deadline) revert ProposalExpired();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();

        proposal.hasVoted[msg.sender] = true;
        
        // Weight votes by stake - @nichxbt
        uint256 voteWeight = stakes[msg.sender].amount;
        if (voteWeight == 0) voteWeight = 1; // Minimum weight for governance members

        if (support) {
            proposal.votesFor += voteWeight;
        } else {
            proposal.votesAgainst += voteWeight;
        }

        emit SlashVoteCast(proposalId, msg.sender, support, voteWeight);
    }

    /**
     * @notice Execute a successful slash proposal
     * @param proposalId Proposal to execute
     */
    function executeSlash(uint256 proposalId) external nonReentrant {
        SlashProposal storage proposal = slashProposals[proposalId];
        
        if (proposal.deadline == 0) revert ProposalNotFound();
        if (block.timestamp <= proposal.deadline) revert ProposalNotExpired();
        if (proposal.executed) revert AlreadyExecuted();
        
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        if (totalVotes < quorumVotes) revert QuorumNotReached();
        if (proposal.votesFor <= proposal.votesAgainst) revert ProposalFailed();

        proposal.executed = true;

        // Calculate slash amount
        StakeInfo storage info = stakes[proposal.staker];
        uint256 slashAmount = (info.amount * proposal.percentage) / BASIS_POINTS;
        
        info.amount -= slashAmount;
        totalStaked -= slashAmount;

        // Send to treasury
        usdsToken.safeTransfer(treasury, slashAmount);

        emit Slashed(proposal.staker, slashAmount, proposal.reason);
        emit SlashProposalExecuted(proposalId, slashAmount);
    }

    /**
     * @notice Emergency slash without governance (admin only)
     * @param staker Staker to slash
     * @param percentage Slash percentage
     * @param reason Reason for slash
     */
    function emergencySlash(
        address staker,
        uint256 percentage,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (percentage == 0 || percentage > MAX_SLASH_PERCENTAGE) {
            revert InvalidPercentage();
        }

        StakeInfo storage info = stakes[staker];
        uint256 slashAmount = (info.amount * percentage) / BASIS_POINTS;
        
        info.amount -= slashAmount;
        totalStaked -= slashAmount;

        usdsToken.safeTransfer(treasury, slashAmount);

        emit Slashed(staker, slashAmount, reason);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Update minimum stake requirement
     * @param newMinimum New minimum stake
     */
    function setMinimumStake(uint256 newMinimum) external onlyRole(ADMIN_ROLE) {
        uint256 oldMinimum = minimumStake;
        minimumStake = newMinimum;
        emit MinimumStakeUpdated(oldMinimum, newMinimum);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update voting parameters
     * @param _votingDuration New voting duration
     * @param _quorumVotes New quorum requirement
     */
    function setVotingParams(
        uint256 _votingDuration,
        uint256 _quorumVotes
    ) external onlyRole(ADMIN_ROLE) {
        votingDuration = _votingDuration;
        quorumVotes = _quorumVotes;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get stake amount for a user
     * @param user User address
     * @return amount Staked amount
     */
    function getStake(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    /**
     * @notice Get full stake info for a user
     * @param user User address
     * @return info Complete stake information
     */
    function getStakeInfo(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    /**
     * @notice Check if user meets minimum stake
     * @param user User address
     * @return meetsMinimum True if stake >= minimum
     */
    function meetsMinimumStake(address user) external view returns (bool) {
        return stakes[user].amount >= minimumStake;
    }

    /**
     * @notice Get proposal info
     * @param proposalId Proposal ID
     * @return toolId Tool ID
     * @return staker Staker address
     * @return percentage Slash percentage
     * @return reason Slash reason
     * @return votesFor Votes for
     * @return votesAgainst Votes against
     * @return deadline Voting deadline
     * @return executed Has been executed
     */
    function getProposal(uint256 proposalId) external view returns (
        bytes32 toolId,
        address staker,
        uint256 percentage,
        string memory reason,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 deadline,
        bool executed
    ) {
        SlashProposal storage p = slashProposals[proposalId];
        return (
            p.toolId,
            p.staker,
            p.percentage,
            p.reason,
            p.votesFor,
            p.votesAgainst,
            p.deadline,
            p.executed
        );
    }

    /**
     * @notice Check if an address has voted on a proposal
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return hasVoted True if has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return slashProposals[proposalId].hasVoted[voter];
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}
}

// EOF - nicholas | universal-crypto-mcp
