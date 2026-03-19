// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ReceiverTemplate } from "./interfaces/ReceiverTemplate.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

/**
 * @title RuleRegistry
 * @author x402-cre-alerts
 * @notice On-chain registry for storing crypto price alert rules
 * 
 * @dev This contract serves as both:
 * 1. A Chainlink CRE (Chainlink Runtime Environment) receiver that accepts reports
 *    from CRE workflows containing price alert rules
 * 2. An x402 payment receiver that can accept USDC payments and allow owner withdrawals
 * 
 * Architecture:
 * - Rules are written to the contract via CRE workflow reports
 * - Rules are stored in a mapping with incremental IDs for efficient iteration
 * - The contract can receive USDC payments (from x402 protocol)
 * - Only the owner can withdraw accumulated USDC
 * 
 * Flow:
 * 1. CRE workflow receives alert data from server
 * 2. CRE workflow encodes alert data and sends report to this contract
 * 3. Contract decodes report and stores rule in mapping
 * 4. CRE cron job monitors prices and checks rules against current prices
 * 5. When conditions are met, notifications are sent via Pushover API
 */
contract RuleRegistry is ReceiverTemplate {
    // ============================================================================
    // Types & Data Structures
    // ============================================================================

    /**
     * @notice Price alert rule structure
     * @dev Rules are stored on-chain and can be queried by the CRE workflow
     * @param id Deterministic rule ID (SHA256 hash of alert data) - bytes32 for on-chain compatibility
     * @param asset Cryptocurrency asset symbol (e.g., "BTC", "ETH", "LINK")
     * @param condition Price condition: "gt", "lt", "gte", or "lte"
     * @param targetPriceUsd Target price in USD (stored as uint256, no decimals)
     * @param createdAt UNIX timestamp (seconds) when the rule was created
     */
    struct Rule {
        bytes32 id;
        string asset;
        string condition;
        uint256 targetPriceUsd;
        uint256 createdAt;
    }

    // ============================================================================
    // State Variables
    // ============================================================================

    /**
     * @notice USDC token contract address
     * @dev Set in constructor, used for receiving x402 payments
     * @dev USDC typically has 6 decimals
     */
    address public usdcToken;

    /**
     * @notice Next available rule ID
     * @dev Increments each time a new rule is written
     * @dev Used to iterate over all rules (0 to nextRuleId - 1)
     */
    uint256 public nextRuleId;

    /**
     * @notice Mapping from rule ID to Rule struct
     * @dev Rules are stored with incremental IDs starting from 0
     * @dev To get all rules, iterate from 0 to nextRuleId - 1
     */
    mapping(uint256 => Rule) public rules;

    // ============================================================================
    // Events
    // ============================================================================

    /**
     * @notice Emitted when a new rule is created
     * @param ruleId The incremental rule ID assigned to this rule
     * @param id The deterministic rule ID (bytes32 hash)
     * @param asset Cryptocurrency asset symbol
     * @param condition Price condition string
     * @param targetPriceUsd Target price in USD
     * @param createdAt UNIX timestamp when rule was created
     */
    event RuleCreated(
        uint256 indexed ruleId,
        bytes32 indexed id,
        string asset,
        string condition,
        uint256 targetPriceUsd,
        uint256 createdAt
    );

    /**
     * @notice Emitted when USDC is withdrawn from the contract
     * @param token The token address (USDC)
     * @param to The recipient address
     * @param amount The amount withdrawn (in USDC's decimals, typically 6)
     */
    event Withdrawal(address indexed token, address indexed to, uint256 amount);

    // ============================================================================
    // Modifiers
    // ============================================================================

    // ============================================================================
    // Constructor
    // ============================================================================

    /**
     * @notice Initializes the RuleRegistry contract
     * @dev Sets the owner to the deployer and configures USDC token address and Chainlink Forwarder
     * @param _usdcToken Address of the USDC token contract (for x402 payments)
     * @param _forwarderAddress Address of the Chainlink Forwarder contract (required for CRE report validation)
     * 
     * @custom:note The forwarder address is required for security - it ensures only verified CRE reports
     *             are processed. Find the correct forwarder address for your network in the CRE documentation.
     */
    constructor(address _usdcToken, address _forwarderAddress) ReceiverTemplate(_forwarderAddress) {
        require(_usdcToken != address(0), "RuleRegistry: USDC token address cannot be zero");
        require(_forwarderAddress != address(0), "RuleRegistry: Forwarder address cannot be zero");
        usdcToken = _usdcToken;
    }

    // ============================================================================
    // Internal Functions
    // ============================================================================

    /**
     * @notice Writes a new rule to the registry
     * @dev Internal function called by _processReport when receiving CRE reports
     * @dev Assigns incremental rule ID and emits RuleCreated event
     * @param _id Deterministic rule ID (bytes32 hash of alert data)
     * @param _asset Cryptocurrency asset symbol
     * @param _condition Price condition string ("gt", "lt", "gte", "lte")
     * @param _targetPriceUsd Target price in USD
     * @param _createdAt UNIX timestamp when rule was created
     * @return ruleId The incremental rule ID assigned to this rule
     */
    function writeRule(
        bytes32 _id,
        string memory _asset,
        string memory _condition,
        uint256 _targetPriceUsd,
        uint256 _createdAt
    ) private returns (uint256) {
        // Assign next available rule ID
        uint256 ruleId = nextRuleId;
        nextRuleId++;

        // Store rule in mapping
        rules[ruleId] = Rule({
            id: _id,
            asset: _asset,
            condition: _condition,
            targetPriceUsd: _targetPriceUsd,
            createdAt: _createdAt
        });

        // Emit event for off-chain indexing and monitoring
        emit RuleCreated(ruleId, _id, _asset, _condition, _targetPriceUsd, _createdAt);

        return ruleId;
    }

    // ============================================================================
    // CRE Workflow Integration (IReceiverTemplate Implementation)
    // ============================================================================

    /**
     * @notice Processes a report received from a Chainlink CRE workflow
     * @dev Internal function called by onReport after metadata validation
     * @dev Decodes the report bytes into rule parameters and writes to registry
     * @param report The encoded report data containing rule parameters
     * 
     * @custom:note Report format (ABI-encoded):
     *             - bytes32 id
     *             - string asset
     *             - string condition
     *             - uint256 targetPriceUsd
     *             - uint256 createdAt
     * 
     * @custom:note This function is called by the CRE workflow when it needs to
     *             write a new price alert rule on-chain. The CRE workflow receives
     *             alert data from the server and encodes it into this report format.
     */
    function _processReport(bytes calldata report) internal override {
        // Decode report data into rule parameters
        // The report is ABI-encoded with: (bytes32, string, string, uint256, uint256)
        (bytes32 id, string memory asset, string memory condition, uint256 targetPriceUsd, uint256 createdAt) =
            abi.decode(report, (bytes32, string, string, uint256, uint256));

        // Write rule to registry
        writeRule(id, asset, condition, targetPriceUsd, createdAt);
    }

    // ============================================================================
    // Public View Functions
    // ============================================================================

    /**
     * @notice Retrieves a single rule by its rule ID
     * @dev Public view function for querying individual rules
     * @param _ruleId The incremental rule ID (0-indexed)
     * @return Rule struct containing all rule data
     * 
     * @custom:reverts If ruleId >= nextRuleId (rule doesn't exist)
     */
    function getRule(uint256 _ruleId) public view returns (Rule memory) {
        require(_ruleId < nextRuleId, "Rule does not exist");
        return rules[_ruleId];
    }

    /**
     * @notice Retrieves all rules stored in the registry
     * @dev Public view function that returns all rules as an array
     * @dev Iterates from rule ID 0 to nextRuleId - 1
     * @return Array of all Rule structs
     * 
     * @custom:gas This function can be gas-intensive for large numbers of rules.
     *             Consider using getRuleCount() and getRule() for pagination.
     */
    function getAllRules() public view returns (Rule[] memory) {
        // Allocate array with size equal to number of rules
        Rule[] memory allRules = new Rule[](nextRuleId);
        
        // Populate array by iterating over all rule IDs
        for (uint256 i = 0; i < nextRuleId; i++) {
            allRules[i] = rules[i];
        }
        
        return allRules;
    }

    /**
     * @notice Returns the total number of rules stored in the registry
     * @dev Useful for pagination and determining array sizes
     * @return The number of rules (equal to nextRuleId)
     */
    function getRuleCount() public view returns (uint256) {
        return nextRuleId;
    }

    // ============================================================================
    // x402 Payment Receiver Functions
    // ============================================================================

    /**
     * @notice Gets the USDC balance of this contract
     * @dev This contract can receive USDC payments via x402 protocol
     * @dev The balance accumulates as users pay for creating alerts
     * @return The USDC balance of the contract (in USDC's decimals, typically 6)
     * 
     * @custom:note USDC has 6 decimals, so a return value of 1000000 represents 1 USDC
     * 
     * @custom:reverts If usdcToken address is not set (should never happen after deployment)
     */
    function getUSDCBalance() external view returns (uint256) {
        require(usdcToken != address(0), "RuleRegistry: USDC token address not set");
        IERC20 usdc = IERC20(usdcToken);
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Withdraws USDC tokens from the contract
     * @dev Only the contract owner can withdraw accumulated USDC payments
     * @dev This allows the owner to collect payments received via x402 protocol
     * @param to The address to send the USDC to
     * @param amount The amount of USDC to withdraw (in USDC's decimals, typically 6)
     * 
     * @custom:note USDC has 6 decimals, so to withdraw 1 USDC, pass 1000000
     * 
     * @custom:reverts If:
     *             - Caller is not the owner
     *             - usdcToken address is not set
     *             - to address is zero
     *             - amount is zero
     *             - Contract balance is insufficient
     *             - USDC transfer fails
     * 
     * @custom:emits Withdrawal event on successful withdrawal
     */
    function withdrawUSDC(address to, uint256 amount) external onlyOwner {
        require(usdcToken != address(0), "RuleRegistry: USDC token address not set");
        require(to != address(0), "RuleRegistry: invalid recipient address");
        require(amount > 0, "RuleRegistry: amount must be greater than zero");

        IERC20 usdc = IERC20(usdcToken);
        uint256 balance = usdc.balanceOf(address(this));
        require(balance >= amount, "RuleRegistry: insufficient USDC balance");

        // Transfer USDC to recipient
        require(usdc.transfer(to, amount), "RuleRegistry: USDC transfer failed");
        
        // Emit event for off-chain monitoring
        emit Withdrawal(usdcToken, to, amount);
    }
}
