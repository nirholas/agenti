# 02 - USDs Token Contract

## Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| **Standard** | ERC-20 with Rebase |
| **Decimals** | 18 |
| **Name** | Sperax USD |
| **Symbol** | USDs |

---

## Core Mechanism: Rebase

USDs uses a **credit system** to implement auto-yield:

```solidity
// User's visible balance
balance = creditBalance / creditsPerToken

// When yield is distributed:
// creditsPerToken DECREASES
// All balances INCREASE proportionally
```

### Rebase Eligibility

| Account Type | Default Status | Can Change? |
|--------------|----------------|-------------|
| EOA (Wallet) | ✅ Opted-In | Yes |
| Smart Contract | ❌ Opted-Out | Yes |
| Non-Rebasing | ❌ Fixed Balance | Yes |

---

## State Variables

```solidity
// Core state
address public vault;                    // VaultCore address
uint256 public totalSupply;              // Total USDs supply
uint256 public nonRebasingSupply;        // Non-rebasing portion

// Rebase mechanics
uint256 internal _creditsPerToken;       // Decreases as yield accrues
uint256 internal constant RESOLUTION_INCREASE = 1e9;

// User balances
mapping(address => uint256) internal _creditBalances;  // Credits per user
mapping(address => RebaseState) public rebaseState;   // Opt-in status

// Allowances
mapping(address => mapping(address => uint256)) internal _allowances;
```

### RebaseState Enum

```solidity
enum RebaseState {
    Uninitialized,  // 0: Not set (defaults to StdRebasing for EOA)
    StdRebasing,    // 1: Receives rebase yield
    StdNonRebasing, // 2: Does NOT receive rebase yield
    YieldDelegator, // 3: Delegates yield to another address
    YieldDelegatee  // 4: Receives delegated yield
}
```

---

## Constructor & Initialization

```solidity
constructor() {
    _disableInitializers();
}

function initialize(
    string memory _nameArg,
    string memory _symbolArg
) external initializer {
    __ERC20_init(_nameArg, _symbolArg);
    __ReentrancyGuard_init();
    _creditsPerToken = 1e27;  // Initial credits per token
}
```

---

## Admin Functions

### updateVault

```solidity
/// @notice Update the vault address
/// @param _newVault New vault contract address
/// @dev Only owner can call
function updateVault(address _newVault) external onlyOwner;
```

### changeSupply (Rebase)

```solidity
/// @notice Modify the supply to rebase (distribute yield)
/// @param _newTotalSupply The new total supply after yield
/// @dev Only callable by Vault during rebase
function changeSupply(uint256 _newTotalSupply) external onlyVault;
```

**Emits**: `TotalSupplyUpdated(uint256 totalSupply, uint256 rebasingCredits, uint256 rebasingCreditsPerToken)`

---

## Mint & Burn

### mint

```solidity
/// @notice Mint USDs tokens
/// @param _account Recipient address
/// @param _amount Amount to mint (18 decimals)
/// @dev Only callable by Vault
function mint(address _account, uint256 _amount) external onlyVault;
```

**Emits**: `Transfer(address(0), _account, _amount)`

### burn

```solidity
/// @notice Burn USDs tokens
/// @param _account Address to burn from
/// @param _amount Amount to burn (18 decimals)
/// @dev Only callable by Vault
function burn(address _account, uint256 _amount) external onlyVault;
```

**Emits**: `Transfer(_account, address(0), _amount)`

---

## Rebase Opt-In/Out

### rebaseOptIn

```solidity
/// @notice Opt into receiving rebase yield
/// @dev Smart contracts are opted-out by default, must call this
function rebaseOptIn() external;
```

**Effect**: Converts fixed balance to credit-based balance

### rebaseOptOut

```solidity
/// @notice Opt out of receiving rebase yield
/// @dev Balance becomes fixed, no longer grows
function rebaseOptOut() external;
```

**Effect**: Converts credit balance to fixed balance

---

## Yield Delegation

### delegateYield

```solidity
/// @notice Delegate your yield to another address
/// @param _to Address to receive your yield
function delegateYield(address _to) external;
```

**Requirements**:
- Caller must be rebasing
- `_to` cannot be zero address
- `_to` cannot already be a delegator

### undelegateYield

```solidity
/// @notice Stop delegating yield
function undelegateYield() external;
```

**Effect**: Returns to normal rebasing state

---

## View Functions

### balanceOf

```solidity
/// @notice Get the balance of an account
/// @param _account The address to query
/// @return The balance in USDs (18 decimals)
function balanceOf(address _account) public view returns (uint256) {
    if (rebaseState[_account] == RebaseState.StdNonRebasing) {
        return _creditBalances[_account];  // Fixed balance
    }
    return _creditBalances[_account] / _creditsPerToken;  // Rebasing balance
}
```

### creditsBalanceOf

```solidity
/// @notice Get credit balance and credits per token
/// @param _account The address to query
/// @return credits The credit balance
/// @return creditsPerToken The current credits per token ratio
function creditsBalanceOf(address _account) 
    public view 
    returns (uint256 credits, uint256 creditsPerToken);
```

### rebasingCredits

```solidity
/// @notice Get total rebasing credits in the system
/// @return Total credits participating in rebase
function rebasingCredits() public view returns (uint256);
```

### rebasingCreditsPerToken

```solidity
/// @notice Get current credits per token ratio
/// @return The ratio (decreases as yield accrues)
function rebasingCreditsPerToken() public view returns (uint256);
```

---

## Standard ERC-20 Functions

```solidity
function name() public view returns (string memory);
function symbol() public view returns (string memory);
function decimals() public view returns (uint8);  // Always 18
function totalSupply() public view returns (uint256);
function allowance(address owner, address spender) public view returns (uint256);
function approve(address spender, uint256 amount) public returns (bool);
function transfer(address to, uint256 amount) public returns (bool);
function transferFrom(address from, address to, uint256 amount) public returns (bool);
```

---

## Events

```solidity
// Standard ERC-20
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);

// Rebase
event TotalSupplyUpdated(
    uint256 totalSupply,
    uint256 rebasingCredits,
    uint256 rebasingCreditsPerToken
);

// Opt-in/out
event RebaseOptIn(address indexed account);
event RebaseOptOut(address indexed account);

// Yield delegation
event YieldDelegated(address indexed delegator, address indexed delegatee);
event YieldUndelegated(address indexed delegator, address indexed delegatee);

// Admin
event VaultUpdated(address newVault);
```

---

## Errors

```solidity
error NotVault();                    // Caller is not the vault
error InvalidRebaseState();          // Invalid state transition
error AlreadyDelegating();           // Already delegating yield
error NotDelegating();               // Not currently delegating
error CannotDelegateToSelf();        // Cannot delegate to yourself
error TransferGreaterThanBal(uint256 amount, uint256 balance);
error InsufficientAllowance(uint256 required, uint256 allowed);
```

---

## Constants

```solidity
uint256 internal constant RESOLUTION_INCREASE = 1e9;
uint256 internal constant MAX_SUPPLY = type(uint128).max;
```
