/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Spreading good vibes through good code 🌻
 */

import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  BookOpen,
  ChevronRight,
  Clock,
  ArrowLeft,
  ArrowRight,
  Code2,
  Shield,
  Zap,
  Wallet,
  FileCode,
  Rocket,
  Home
} from 'lucide-react';

interface DocArticle {
  id: string;
  title: string;
  description: string;
  readTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: string;
}

interface DocCategory {
  id: string;
  title: string;
  icon: React.JSX.Element;
  description: string;
  articles: DocArticle[];
}

const docCategories: DocCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Rocket className="w-6 h-6" />,
    description: 'New to the platform? Start here',
    articles: [
      { 
        id: 'intro', 
        title: 'Introduction to Lyra Web3 Playground', 
        description: 'Learn what this platform can do for you', 
        readTime: '5 min', 
        difficulty: 'beginner',
        content: `
## Welcome to Lyra Web3 Playground

Lyra Web3 Playground is your interactive development environment for learning and building smart contracts. Whether you're just starting your Web3 journey or you're an experienced developer, our platform provides the tools you need to write, compile, test, and deploy smart contracts.

### What You Can Do

- **Write Smart Contracts**: Use our full-featured Solidity editor with syntax highlighting and auto-completion
- **Compile in Real-Time**: Instantly compile your contracts and see errors and warnings
- **Deploy to Testnets**: Deploy your contracts to Sepolia, Mumbai, and other test networks
- **Learn with Tutorials**: Follow step-by-step tutorials to master smart contract development
- **Use Templates**: Start from pre-built templates for common use cases like tokens, NFTs, and DeFi

### Getting Started

1. **Explore the Sandbox**: Visit the [Sandbox](/sandbox) to start writing code immediately
2. **Follow a Tutorial**: Check out our [Tutorials](/tutorials) for guided learning experiences
3. **Browse Examples**: See real-world [Examples](/examples) to understand best practices
4. **Connect Your Wallet**: Link your Web3 wallet to deploy contracts to testnets

### Requirements

- A modern web browser (Chrome, Firefox, Edge, or Brave recommended)
- A Web3 wallet like MetaMask for deployment (optional for learning)
- Some testnet tokens for deployment (we provide faucet links)

Ready to build your first smart contract? Continue to the next article!
        `
      },
      { 
        id: 'first-contract', 
        title: 'Your First Smart Contract', 
        description: 'Write, compile, and deploy in 10 minutes', 
        readTime: '10 min', 
        difficulty: 'beginner',
        content: `
## Your First Smart Contract

Let's create a simple smart contract that stores and retrieves a value. This is the "Hello World" of smart contract development.

### Step 1: Open the Sandbox

Navigate to the [Sandbox](/sandbox) to access the code editor.

### Step 2: Write Your Contract

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleStorage {
    uint256 private storedValue;
    
    event ValueChanged(uint256 newValue);
    
    function store(uint256 value) public {
        storedValue = value;
        emit ValueChanged(value);
    }
    
    function retrieve() public view returns (uint256) {
        return storedValue;
    }
}
\`\`\`

### Step 3: Compile

Click the "Compile" button to compile your contract. You should see a success message if there are no errors.

### Step 4: Deploy (Optional)

If you want to deploy to a testnet:

1. Connect your wallet using the "Connect Wallet" button
2. Make sure you have testnet ETH (use a faucet if needed)
3. Select your target network (Sepolia recommended for beginners)
4. Click "Deploy" and confirm the transaction

Congratulations! You've written and deployed your first smart contract!
        `
      },
      { 
        id: 'sandbox-basics', 
        title: 'Understanding the Sandbox', 
        description: 'Navigate the interactive development environment', 
        readTime: '7 min', 
        difficulty: 'beginner',
        content: `
## Understanding the Sandbox

The Sandbox is your all-in-one development environment for smart contracts. Let's explore its features.

### Editor Panel

The left side of the Sandbox contains the code editor where you write your Solidity code. Features include:

- **Syntax Highlighting**: Code is color-coded for readability
- **Auto-completion**: Get suggestions as you type
- **Error Indicators**: See issues highlighted in real-time
- **Line Numbers**: Easy navigation through your code

### Output Panel

The right side shows compilation results, deployment status, and interaction options:

- **Compiler Output**: View warnings, errors, and compilation details
- **ABI & Bytecode**: Access the compiled contract artifacts
- **Contract Interaction**: Call functions on deployed contracts

### Toolbar

The top toolbar provides quick access to common actions:

- **Compile**: Compile your current contract
- **Deploy**: Deploy to selected network
- **Settings**: Configure compiler options
- **Share**: Generate a shareable link to your code

### Keyboard Shortcuts

- \`Ctrl/Cmd + S\`: Save and compile
- \`Ctrl/Cmd + Enter\`: Deploy contract
- \`Ctrl/Cmd + /\`: Toggle comment
        `
      },
      { 
        id: 'innovation-mode', 
        title: 'Activating Innovation Mode', 
        description: 'Unlock AI-powered features', 
        readTime: '5 min', 
        difficulty: 'beginner',
        content: `
## Innovation Mode

Innovation Mode unlocks AI-powered features to supercharge your development workflow.

### What is Innovation Mode?

Innovation Mode integrates AI capabilities directly into your development experience:

- **AI Code Suggestions**: Get intelligent code completions
- **Security Analysis**: AI-powered vulnerability detection
- **Gas Optimization Tips**: Suggestions to reduce gas costs
- **Natural Language to Code**: Describe what you want, get Solidity code

### Activating Innovation Mode

1. Click the ✨ icon in the toolbar
2. Sign in or create an account
3. Enable Innovation Mode in settings

### Using AI Features

Once activated, you can:

- Type a comment describing what you want, and AI will suggest code
- Highlight code and ask for explanations or improvements
- Use the AI chat to ask questions about your contract

### Best Practices

- Always review AI-generated code before deploying
- Use AI suggestions as a starting point, not final code
- Combine AI assistance with your own understanding
        `
      }
    ]
  },
  {
    id: 'solidity',
    title: 'Solidity Fundamentals',
    icon: <Code2 className="w-6 h-6" />,
    description: 'Master the language of smart contracts',
    articles: [
      { 
        id: 'solidity-basics', 
        title: 'Solidity Syntax Basics', 
        description: 'Variables, types, and functions', 
        readTime: '15 min', 
        difficulty: 'beginner',
        content: `
## Solidity Syntax Basics

Solidity is the primary programming language for Ethereum smart contracts. Let's cover the fundamentals.

### Contract Structure

Every Solidity file starts with a license identifier and pragma statement:

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    // Contract code here
}
\`\`\`

### Variable Types

Solidity has several built-in types:

**Value Types:**
- \`uint256\`: Unsigned integer (0 to 2^256-1)
- \`int256\`: Signed integer
- \`bool\`: Boolean (true/false)
- \`address\`: Ethereum address (20 bytes)
- \`bytes32\`: Fixed-size byte array

**Reference Types:**
- \`string\`: Dynamic string
- \`bytes\`: Dynamic byte array
- \`array\`: Fixed or dynamic arrays
- \`mapping\`: Key-value store

### Functions

Functions are declared with visibility and state mutability:

\`\`\`solidity
function myFunction(uint256 x) public pure returns (uint256) {
    return x * 2;
}
\`\`\`

**Visibility:**
- \`public\`: Callable from anywhere
- \`private\`: Only within contract
- \`internal\`: Within contract and derived contracts
- \`external\`: Only from outside

**State Mutability:**
- \`view\`: Reads state but doesn't modify
- \`pure\`: Doesn't read or modify state
- \`payable\`: Can receive ETH
        `
      },
      { 
        id: 'data-structures', 
        title: 'Data Structures', 
        description: 'Arrays, mappings, and structs', 
        readTime: '12 min', 
        difficulty: 'intermediate',
        content: `
## Data Structures in Solidity

Understanding data structures is crucial for efficient smart contract development.

### Arrays

Arrays can be fixed-size or dynamic:

\`\`\`solidity
uint256[5] fixedArray;        // Fixed size
uint256[] dynamicArray;       // Dynamic size

function addElement(uint256 value) public {
    dynamicArray.push(value);
}
\`\`\`

### Mappings

Mappings are key-value stores, perfect for lookups:

\`\`\`solidity
mapping(address => uint256) public balances;
mapping(address => mapping(address => bool)) public approvals;

function setBalance(address user, uint256 amount) public {
    balances[user] = amount;
}
\`\`\`

### Structs

Structs let you define custom types:

\`\`\`solidity
struct User {
    string name;
    uint256 age;
    address wallet;
}

mapping(address => User) public users;

function createUser(string memory name, uint256 age) public {
    users[msg.sender] = User(name, age, msg.sender);
}
\`\`\`

### Enums

Enums define a set of named constants:

\`\`\`solidity
enum Status { Pending, Active, Completed, Cancelled }

Status public currentStatus = Status.Pending;
\`\`\`
        `
      },
      { 
        id: 'inheritance', 
        title: 'Contract Inheritance', 
        description: 'Building on existing contracts', 
        readTime: '10 min', 
        difficulty: 'intermediate',
        content: `
## Contract Inheritance

Inheritance allows you to build on existing contracts and reuse code.

### Basic Inheritance

Use the \`is\` keyword to inherit:

\`\`\`solidity
contract Animal {
    string public name;
    
    function speak() public virtual returns (string memory) {
        return "...";
    }
}

contract Dog is Animal {
    constructor() {
        name = "Dog";
    }
    
    function speak() public pure override returns (string memory) {
        return "Woof!";
    }
}
\`\`\`

### Multiple Inheritance

Solidity supports multiple inheritance:

\`\`\`solidity
contract A {
    function foo() public virtual returns (string memory) {
        return "A";
    }
}

contract B {
    function foo() public virtual returns (string memory) {
        return "B";
    }
}

contract C is A, B {
    function foo() public pure override(A, B) returns (string memory) {
        return "C";
    }
}
\`\`\`

### Abstract Contracts

Abstract contracts contain unimplemented functions:

\`\`\`solidity
abstract contract Base {
    function getValue() public virtual returns (uint256);
}

contract Implementation is Base {
    function getValue() public pure override returns (uint256) {
        return 42;
    }
}
\`\`\`
        `
      },
      { 
        id: 'modifiers', 
        title: 'Function Modifiers', 
        description: 'Access control and reusability', 
        readTime: '8 min', 
        difficulty: 'intermediate',
        content: `
## Function Modifiers

Modifiers are reusable code that can be applied to functions for access control and validation.

### Basic Modifier

\`\`\`solidity
contract Ownable {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;  // Continue with the function
    }
    
    function restrictedAction() public onlyOwner {
        // Only owner can call this
    }
}
\`\`\`

### Modifier with Parameters

\`\`\`solidity
modifier minimumAmount(uint256 amount) {
    require(msg.value >= amount, "Insufficient amount");
    _;
}

function deposit() public payable minimumAmount(1 ether) {
    // Requires at least 1 ETH
}
\`\`\`

### Multiple Modifiers

Functions can have multiple modifiers:

\`\`\`solidity
modifier whenNotPaused() {
    require(!paused, "Contract is paused");
    _;
}

function transfer(address to, uint256 amount) 
    public 
    onlyOwner 
    whenNotPaused 
{
    // Both conditions must pass
}
\`\`\`

### Common Patterns

- **onlyOwner**: Restrict to contract owner
- **whenNotPaused**: Check pause state
- **nonReentrant**: Prevent reentrancy attacks
- **validAddress**: Verify non-zero address
        `
      },
      { 
        id: 'events', 
        title: 'Events and Logging', 
        description: 'Communicate with the frontend', 
        readTime: '10 min', 
        difficulty: 'intermediate',
        content: `
## Events and Logging

Events allow smart contracts to communicate with external applications and provide an audit trail.

### Declaring Events

\`\`\`solidity
event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
);

event Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
);
\`\`\`

### Emitting Events

\`\`\`solidity
function transfer(address to, uint256 amount) public {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    
    emit Transfer(msg.sender, to, amount);
}
\`\`\`

### Indexed Parameters

- Up to 3 parameters can be \`indexed\`
- Indexed parameters are searchable/filterable
- Use for addresses, IDs, and categories

### Listening to Events (JavaScript)

\`\`\`javascript
contract.on("Transfer", (from, to, value, event) => {
    console.log(\`Transfer: \${from} -> \${to}: \${value}\`);
});

// Query past events
const events = await contract.queryFilter(
    contract.filters.Transfer(myAddress, null),
    fromBlock,
    toBlock
);
\`\`\`

### Best Practices

- Emit events for all state changes
- Use indexed for frequently filtered fields
- Keep event data minimal (gas costs)
- Document events in your interface
        `
      }
    ]
  },
  {
    id: 'security',
    title: 'Smart Contract Security',
    icon: <Shield className="w-6 h-6" />,
    description: 'Build secure, auditable contracts',
    articles: [
      { 
        id: 'common-vulnerabilities', 
        title: 'Common Vulnerabilities', 
        description: 'Top 10 smart contract security issues', 
        readTime: '20 min', 
        difficulty: 'intermediate',
        content: `
## Common Smart Contract Vulnerabilities

Understanding these vulnerabilities is essential for writing secure contracts.

### 1. Reentrancy

External calls can call back into your contract before state updates:

\`\`\`solidity
// VULNERABLE
function withdraw() public {
    uint256 amount = balances[msg.sender];
    (bool success, ) = msg.sender.call{value: amount}("");
    balances[msg.sender] = 0;  // Too late!
}

// SAFE - Checks-Effects-Interactions
function withdraw() public {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;  // Update first
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
\`\`\`

### 2. Integer Overflow/Underflow

Prior to Solidity 0.8, arithmetic could overflow silently. Use SafeMath for older versions or Solidity 0.8+.

### 3. Unchecked External Calls

Always check return values:

\`\`\`solidity
(bool success, ) = recipient.call{value: amount}("");
require(success, "Transfer failed");
\`\`\`

### 4. Access Control Issues

- Missing function visibility
- Incorrect modifier logic
- Unprotected admin functions

### 5. Front-Running

Transactions in the mempool can be seen and exploited. Mitigate with commit-reveal schemes.

### 6. Denial of Service

- Unbounded loops
- Block gas limit issues
- External call failures blocking functionality

### 7. Oracle Manipulation

Don't rely on single price sources. Use Chainlink or multiple oracles.

### 8. Signature Replay

Include nonces and chain ID in signed messages.

### 9. Floating Pragma

Lock your pragma version: \`pragma solidity 0.8.19;\`

### 10. Uninitialized Storage

Always initialize storage variables explicitly.
        `
      },
      { 
        id: 'reentrancy', 
        title: 'Reentrancy Attacks Explained', 
        description: 'How they work and how to prevent them', 
        readTime: '15 min', 
        difficulty: 'advanced',
        content: `
## Reentrancy Attacks Explained

Reentrancy is one of the most dangerous vulnerabilities in smart contracts.

### How It Works

1. Contract A calls Contract B
2. Before A finishes, B calls back into A
3. A's state hasn't updated yet
4. B exploits the stale state

### The DAO Attack Example

\`\`\`solidity
// VULNERABLE CONTRACT
contract VulnerableBank {
    mapping(address => uint256) public balances;
    
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        
        // External call BEFORE state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        
        balances[msg.sender] = 0;
    }
}

// ATTACKER CONTRACT
contract Attacker {
    VulnerableBank public bank;
    
    receive() external payable {
        if (address(bank).balance >= 1 ether) {
            bank.withdraw();  // Re-enter!
        }
    }
    
    function attack() public payable {
        bank.deposit{value: 1 ether}();
        bank.withdraw();
    }
}
\`\`\`

### Prevention Techniques

**1. Checks-Effects-Interactions Pattern:**

\`\`\`solidity
function withdraw() public {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "No balance");
    
    balances[msg.sender] = 0;  // Effect first
    
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
\`\`\`

**2. ReentrancyGuard:**

\`\`\`solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SafeBank is ReentrancyGuard {
    function withdraw() public nonReentrant {
        // Protected from reentrancy
    }
}
\`\`\`

**3. Pull Over Push:**

Let users withdraw instead of pushing payments.
        `
      },
      { 
        id: 'access-control', 
        title: 'Access Control Patterns', 
        description: 'Secure your contract functions', 
        readTime: '12 min', 
        difficulty: 'intermediate',
        content: `
## Access Control Patterns

Proper access control is essential for contract security.

### Ownable Pattern

The simplest access control - single owner:

\`\`\`solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    function adminOnly() public onlyOwner {
        // Only owner can call
    }
    
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }
}
\`\`\`

### Role-Based Access Control

More flexible - multiple roles:

\`\`\`solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyContract is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        // Only minters can call
    }
}
\`\`\`

### Multi-Signature

Require multiple approvals:

\`\`\`solidity
contract MultiSig {
    mapping(address => bool) public isOwner;
    uint256 public required;
    
    struct Transaction {
        address to;
        uint256 value;
        uint256 confirmations;
        bool executed;
    }
    
    function confirmTransaction(uint256 txId) public {
        require(isOwner[msg.sender]);
        // Add confirmation logic
    }
}
\`\`\`

### Timelock

Delay sensitive operations:

\`\`\`solidity
contract Timelock {
    uint256 public constant DELAY = 2 days;
    mapping(bytes32 => uint256) public pendingActions;
    
    function queue(bytes32 actionId) public onlyOwner {
        pendingActions[actionId] = block.timestamp + DELAY;
    }
    
    function execute(bytes32 actionId) public {
        require(block.timestamp >= pendingActions[actionId]);
        // Execute action
    }
}
\`\`\`
        `
      },
      { 
        id: 'audit-checklist', 
        title: 'Security Audit Checklist', 
        description: 'Pre-deployment security review', 
        readTime: '10 min', 
        difficulty: 'advanced',
        content: `
## Security Audit Checklist

Use this checklist before deploying to mainnet.

### Code Quality

- [ ] Solidity version is locked (not floating)
- [ ] All functions have explicit visibility
- [ ] No unused variables or functions
- [ ] No compiler warnings
- [ ] Code is well-documented

### Access Control

- [ ] Admin functions are protected
- [ ] Owner can be transferred safely
- [ ] No unprotected initialization
- [ ] Modifiers are correctly implemented

### Arithmetic

- [ ] Using Solidity 0.8+ or SafeMath
- [ ] Division by zero is handled
- [ ] No precision loss issues
- [ ] Large numbers handled correctly

### External Calls

- [ ] Return values are checked
- [ ] Reentrancy protection in place
- [ ] Low-level calls avoided when possible
- [ ] Gas limits considered

### Data Validation

- [ ] Input parameters validated
- [ ] Array bounds checked
- [ ] Address zero checks
- [ ] State transitions are valid

### Economic Security

- [ ] No front-running vulnerabilities
- [ ] Flash loan attacks considered
- [ ] Slippage protection implemented
- [ ] Oracle manipulation mitigated

### Testing

- [ ] Unit tests with high coverage
- [ ] Integration tests completed
- [ ] Fuzz testing performed
- [ ] Mainnet fork testing done

### Deployment

- [ ] Constructor parameters verified
- [ ] Proxy upgrade tested (if applicable)
- [ ] Emergency pause mechanism exists
- [ ] Verified on block explorer
        `
      }
    ]
  },
  {
    id: 'gas-optimization',
    title: 'Gas Optimization',
    icon: <Zap className="w-6 h-6" />,
    description: 'Write efficient, cost-effective code',
    articles: [
      { 
        id: 'gas-basics', 
        title: 'Understanding Gas', 
        description: 'How Ethereum pricing works', 
        readTime: '10 min', 
        difficulty: 'beginner',
        content: `
## Understanding Gas

Gas is the unit measuring computational effort on Ethereum.

### What is Gas?

- Every operation costs gas
- Gas price fluctuates with network demand
- Transaction cost = Gas Used × Gas Price
- Gas is paid in ETH (usually measured in Gwei)

### Gas Costs by Operation

| Operation | Approximate Gas |
|-----------|----------------|
| Addition/Subtraction | 3 |
| Multiplication/Division | 5 |
| SLOAD (read storage) | 2,100 |
| SSTORE (write storage) | 20,000-5,000 |
| Contract creation | 32,000+ |
| ETH transfer | 21,000 |

### Storage is Expensive

Storage operations are the most costly:

\`\`\`solidity
// Expensive - multiple storage reads/writes
function bad() public {
    for (uint i = 0; i < arr.length; i++) {
        total += arr[i];  // Reading from storage each time
    }
}

// Better - cache in memory
function better() public {
    uint256[] memory _arr = arr;  // Copy to memory once
    uint256 _total = 0;
    for (uint i = 0; i < _arr.length; i++) {
        _total += _arr[i];
    }
    total = _total;  // Single storage write
}
\`\`\`

### Gas Refunds

- Clearing storage (setting to 0) gives partial refunds
- Refunds are capped at 20% of total gas used
        `
      },
      { 
        id: 'storage-optimization', 
        title: 'Storage Optimization', 
        description: 'Reduce costly storage operations', 
        readTime: '15 min', 
        difficulty: 'intermediate',
        content: `
## Storage Optimization

Storage is the most expensive resource. Optimize it carefully.

### Storage Layout

Ethereum stores data in 32-byte slots. Pack variables to save slots:

\`\`\`solidity
// BAD - Uses 3 slots (96 bytes)
contract Unoptimized {
    uint256 a;  // Slot 0
    uint128 b;  // Slot 1
    uint128 c;  // Slot 2
}

// GOOD - Uses 2 slots (64 bytes)
contract Optimized {
    uint256 a;  // Slot 0
    uint128 b;  // Slot 1 (first 16 bytes)
    uint128 c;  // Slot 1 (last 16 bytes)
}
\`\`\`

### Use Smaller Types When Possible

\`\`\`solidity
// If you know the max value is small
struct Order {
    uint32 timestamp;    // Good until year 2106
    uint128 amount;      // More than enough for tokens
    uint96 orderId;      // Billions of orders
}
\`\`\`

### Avoid Redundant Storage

\`\`\`solidity
// BAD
function updateValues(uint256 a, uint256 b) public {
    value1 = a;
    value2 = b;
    total = value1 + value2;  // Redundant storage
}

// GOOD - Compute on read
function getTotal() public view returns (uint256) {
    return value1 + value2;
}
\`\`\`

### Use Events for Historical Data

Don't store data just for queries - use events instead:

\`\`\`solidity
event TransferRecorded(address from, address to, uint256 amount, uint256 timestamp);

// Don't store in array - emit event
emit TransferRecorded(from, to, amount, block.timestamp);
\`\`\`
        `
      },
      { 
        id: 'loop-optimization', 
        title: 'Optimizing Loops', 
        description: 'Avoid expensive iterations', 
        readTime: '12 min', 
        difficulty: 'intermediate',
        content: `
## Optimizing Loops

Loops can be gas-intensive. Here's how to optimize them.

### Cache Array Length

\`\`\`solidity
// BAD - reads length from storage each iteration
for (uint i = 0; i < arr.length; i++) { }

// GOOD - cache the length
uint256 len = arr.length;
for (uint i = 0; i < len; i++) { }
\`\`\`

### Use Unchecked for Increments

\`\`\`solidity
// Saves ~80 gas per iteration in Solidity 0.8+
for (uint i = 0; i < len;) {
    // loop body
    unchecked { ++i; }
}
\`\`\`

### Avoid Unbounded Loops

\`\`\`solidity
// DANGEROUS - could run out of gas
function processAll() public {
    for (uint i = 0; i < users.length; i++) {
        process(users[i]);
    }
}

// SAFE - process in batches
function processBatch(uint256 start, uint256 count) public {
    uint256 end = start + count;
    if (end > users.length) end = users.length;
    
    for (uint i = start; i < end;) {
        process(users[i]);
        unchecked { ++i; }
    }
}
\`\`\`

### Use Mappings Over Arrays for Lookups

\`\`\`solidity
// BAD - O(n) search
function find(address user) public view returns (bool) {
    for (uint i = 0; i < users.length; i++) {
        if (users[i] == user) return true;
    }
    return false;
}

// GOOD - O(1) lookup
mapping(address => bool) public isUser;
\`\`\`

### Pre-increment vs Post-increment

\`\`\`solidity
++i;  // Slightly cheaper than i++
\`\`\`
        `
      },
      { 
        id: 'packed-storage', 
        title: 'Packed Storage', 
        description: 'Advanced variable packing', 
        readTime: '10 min', 
        difficulty: 'advanced',
        content: `
## Packed Storage

Advanced techniques for minimizing storage costs.

### Understanding Slots

Each storage slot is 32 bytes. Variables smaller than 32 bytes can share slots:

\`\`\`solidity
// All fit in one slot (32 bytes total)
struct PackedData {
    uint128 a;  // 16 bytes
    uint64 b;   // 8 bytes
    uint32 c;   // 4 bytes
    uint16 d;   // 2 bytes
    uint8 e;    // 1 byte
    bool f;     // 1 byte
}
\`\`\`

### Packing in Practice

\`\`\`solidity
// ERC721 style - pack owner + metadata
struct TokenData {
    address owner;      // 20 bytes
    uint48 timestamp;   // 6 bytes
    uint48 aux;         // 6 bytes
}  // Total: 32 bytes = 1 slot
\`\`\`

### Bitmaps for Booleans

Store multiple booleans in a single uint256:

\`\`\`solidity
uint256 private flags;

function setFlag(uint8 index, bool value) public {
    if (value) {
        flags |= (1 << index);
    } else {
        flags &= ~(1 << index);
    }
}

function getFlag(uint8 index) public view returns (bool) {
    return (flags & (1 << index)) != 0;
}
\`\`\`

### Struct Packing Tips

1. Order variables from largest to smallest
2. Group related small variables together
3. Consider using bytes32 for fixed strings
4. Use uint96 for amounts (fits with address in one slot)

\`\`\`solidity
// Optimized for gas
struct Listing {
    address seller;     // 20 bytes
    uint96 price;       // 12 bytes (fits in slot 1)
    uint64 startTime;   // 8 bytes
    uint64 endTime;     // 8 bytes
    uint128 tokenId;    // 16 bytes (slot 2 complete)
}
\`\`\`
        `
      }
    ]
  },
  {
    id: 'defi',
    title: 'DeFi Development',
    icon: <Wallet className="w-6 h-6" />,
    description: 'Build decentralized finance applications',
    articles: [
      { 
        id: 'defi-intro', 
        title: 'Introduction to DeFi', 
        description: 'Understand the DeFi ecosystem', 
        readTime: '15 min', 
        difficulty: 'beginner',
        content: `
## Introduction to DeFi

Decentralized Finance (DeFi) reimagines financial services using blockchain technology.

### What is DeFi?

DeFi replaces traditional financial intermediaries with smart contracts:

- **No banks needed**: Peer-to-peer transactions
- **Permissionless**: Anyone can participate
- **Transparent**: All code is open and auditable
- **Composable**: Protocols can build on each other

### Core DeFi Primitives

**1. Decentralized Exchanges (DEXs)**
- Uniswap, SushiSwap
- Trade tokens without intermediaries
- Automated Market Makers (AMMs)

**2. Lending Protocols**
- Aave, Compound
- Deposit assets to earn interest
- Borrow against collateral

**3. Stablecoins**
- DAI, USDC
- Cryptocurrency pegged to fiat
- Essential for DeFi stability

**4. Yield Aggregators**
- Yearn Finance
- Automatically optimize yields
- Compound strategies

### Key Concepts

**TVL (Total Value Locked):**
The total value of assets deposited in a protocol.

**APY (Annual Percentage Yield):**
Expected yearly returns, including compound interest.

**Liquidity Mining:**
Earning tokens by providing liquidity.

**Flash Loans:**
Borrow without collateral if repaid in same transaction.
        `
      },
      { 
        id: 'token-creation', 
        title: 'Creating ERC-20 Tokens', 
        description: 'Build your own fungible token', 
        readTime: '20 min', 
        difficulty: 'intermediate',
        content: `
## Creating ERC-20 Tokens

ERC-20 is the standard for fungible tokens on Ethereum.

### Basic ERC-20 Token

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
\`\`\`

### Adding Features

**Mintable Token:**

\`\`\`solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintableToken is ERC20, Ownable {
    constructor() ERC20("MintableToken", "MINT") {}
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
\`\`\`

**Burnable Token:**

\`\`\`solidity
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract BurnableToken is ERC20Burnable {
    constructor() ERC20("BurnableToken", "BURN") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
\`\`\`

**Pausable Token:**

\`\`\`solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract PausableToken is ERC20, Pausable, Ownable {
    function pause() public onlyOwner {
        _pause();
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
\`\`\`

### ERC-20 Functions

- \`totalSupply()\`: Total token supply
- \`balanceOf(address)\`: Balance of an account
- \`transfer(to, amount)\`: Transfer tokens
- \`approve(spender, amount)\`: Allow spending
- \`transferFrom(from, to, amount)\`: Spend allowed tokens
        `
      },
      { 
        id: 'liquidity-pools', 
        title: 'Liquidity Pools', 
        description: 'How AMMs work', 
        readTime: '18 min', 
        difficulty: 'advanced',
        content: `
## Liquidity Pools and AMMs

Automated Market Makers (AMMs) enable decentralized token swaps.

### How Liquidity Pools Work

Instead of order books, AMMs use liquidity pools:

1. Liquidity providers deposit token pairs
2. Pools maintain a constant product formula
3. Traders swap against the pool
4. LPs earn fees from trades

### Constant Product Formula

\`\`\`
x * y = k

Where:
- x = Reserve of token A
- y = Reserve of token B
- k = Constant product
\`\`\`

### Simple AMM Implementation

\`\`\`solidity
contract SimpleAMM {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    
    function swap(address tokenIn, uint256 amountIn) public returns (uint256) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB));
        
        bool isTokenA = tokenIn == address(tokenA);
        
        (uint256 reserveIn, uint256 reserveOut) = isTokenA 
            ? (reserveA, reserveB) 
            : (reserveB, reserveA);
        
        // Calculate output amount (with 0.3% fee)
        uint256 amountInWithFee = amountIn * 997;
        uint256 amountOut = (amountInWithFee * reserveOut) / 
                           (reserveIn * 1000 + amountInWithFee);
        
        // Update reserves
        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }
        
        return amountOut;
    }
}
\`\`\`

### Key Concepts

**Impermanent Loss:**
LPs may lose value compared to just holding when prices diverge.

**Slippage:**
Price impact from large trades relative to pool size.

**LP Tokens:**
Represent your share of the pool.
        `
      },
      { 
        id: 'yield-farming', 
        title: 'Yield Farming Mechanics', 
        description: 'Staking and rewards', 
        readTime: '15 min', 
        difficulty: 'advanced',
        content: `
## Yield Farming Mechanics

Yield farming incentivizes liquidity provision with token rewards.

### Basic Staking Contract

\`\`\`solidity
contract StakingRewards {
    IERC20 public stakingToken;
    IERC20 public rewardsToken;
    
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        
        return rewardPerTokenStored + 
            ((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalSupply;
    }
    
    function earned(address account) public view returns (uint256) {
        return (balances[account] * 
            (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 
            + rewards[account];
    }
    
    function stake(uint256 amount) external updateReward(msg.sender) {
        totalSupply += amount;
        balances[msg.sender] += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
    }
    
    function withdraw(uint256 amount) external updateReward(msg.sender) {
        totalSupply -= amount;
        balances[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
    }
    
    function getReward() external updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardsToken.transfer(msg.sender, reward);
    }
}
\`\`\`

### Yield Farming Strategies

**Single Asset Staking:**
Stake one token to earn rewards.

**LP Token Staking:**
Stake liquidity pool tokens for extra rewards.

**Compounding:**
Automatically reinvest rewards.

### Risks

- Smart contract risk
- Impermanent loss (for LPs)
- Token price volatility
- Rug pulls (always verify contracts)
        `
      }
    ]
  },
  {
    id: 'templates',
    title: 'Templates & Playground',
    icon: <FileCode className="w-6 h-6" />,
    description: 'How to use contract templates and the interactive playground',
    articles: [
      { 
        id: 'using-templates', 
        title: 'Using Contract Templates', 
        description: 'Browse, customize, and deploy templates', 
        readTime: '8 min', 
        difficulty: 'beginner',
        content: `
## Using Contract Templates

Templates help you start faster with proven, tested code.

### Available Templates

**Token Templates:**
- ERC-20 Token
- ERC-721 NFT
- ERC-1155 Multi-Token

**DeFi Templates:**
- Staking Contract
- Vesting Contract
- Airdrop Contract

**Utility Templates:**
- Multi-sig Wallet
- Timelock Controller
- Proxy Contracts

### How to Use Templates

1. **Browse**: Go to [Playground](/playground) or [Examples](/examples)
2. **Select**: Choose a template that fits your needs
3. **Customize**: Modify the code for your use case
4. **Deploy**: Compile and deploy to your chosen network

### Customizing Templates

Most templates have configurable parameters:

\`\`\`solidity
// Change these values
string public constant NAME = "MyToken";
string public constant SYMBOL = "MTK";
uint256 public constant INITIAL_SUPPLY = 1000000;
\`\`\`

### Best Practices

- Read through the entire template before using
- Understand what each function does
- Test thoroughly before mainnet deployment
- Consider getting a security audit for high-value contracts
        `
      },
      { 
        id: 'deploy-testnets', 
        title: 'Deploying to Testnets', 
        description: 'Guide to deploying contracts to Sepolia, Mumbai, and other testnets', 
        readTime: '10 min', 
        difficulty: 'intermediate',
        content: `
## Deploying to Testnets

Always test your contracts on testnets before mainnet.

### Supported Testnets

| Network | Chain ID | Currency | Faucet |
|---------|----------|----------|--------|
| Sepolia | 11155111 | SepoliaETH | sepoliafaucet.com |
| Mumbai | 80001 | MATIC | mumbaifaucet.com |
| Goerli | 5 | GoerliETH | goerlifaucet.com |

### Step-by-Step Deployment

**1. Connect Your Wallet**

Click "Connect Wallet" and select your wallet (MetaMask recommended).

**2. Switch to Testnet**

In MetaMask:
- Click network dropdown
- Select your testnet
- Add custom network if needed

**3. Get Test Tokens**

Use a faucet to get free testnet tokens:
- Visit the faucet website
- Enter your wallet address
- Request tokens

**4. Compile Your Contract**

Click "Compile" and ensure there are no errors.

**5. Deploy**

- Click "Deploy"
- Review the transaction
- Confirm in your wallet
- Wait for confirmation

### Verifying Your Contract

After deployment, verify on the block explorer:

1. Go to the explorer (e.g., sepolia.etherscan.io)
2. Find your contract address
3. Click "Verify Contract"
4. Paste your source code
5. Confirm compilation settings

### Common Issues

- **Insufficient funds**: Get more testnet tokens
- **Wrong network**: Switch networks in wallet
- **Nonce issues**: Reset account in MetaMask settings
        `
      },
      { 
        id: 'tutorials-guide', 
        title: 'Following Tutorials', 
        description: 'How tutorial progress and checkpoints work', 
        readTime: '6 min', 
        difficulty: 'beginner',
        content: `
## Following Tutorials

Our tutorial system helps you learn step by step.

### Tutorial Structure

Each tutorial includes:

- **Introduction**: What you'll learn
- **Prerequisites**: What you need to know
- **Steps**: Guided coding exercises
- **Checkpoints**: Verify your progress
- **Quiz**: Test your understanding

### Progress Tracking

Your progress is automatically saved:

- Completed steps are marked with ✓
- You can resume where you left off
- Progress syncs across devices (when signed in)

### Checkpoints

Checkpoints verify your code is correct:

\`\`\`
✓ Contract compiles successfully
✓ Required functions are present
✓ Tests pass
\`\`\`

### Tips for Success

1. **Don't skip steps**: Each builds on the previous
2. **Type the code**: Copying misses the learning
3. **Experiment**: Try modifying examples
4. **Ask questions**: Use the community forum

### Earning Achievements

Complete tutorials to earn achievements:

- 🏆 First Contract: Deploy your first contract
- 🎓 Solidity Master: Complete all Solidity tutorials
- 🛡️ Security Expert: Finish security tutorials
- ⚡ Gas Optimizer: Complete optimization tutorials
        `
      },
      { 
        id: 'contributing-docs', 
        title: 'Contributing to Docs & Templates', 
        description: 'How to submit improvements and new templates', 
        readTime: '6 min', 
        difficulty: 'beginner',
        content: `
## Contributing to Docs & Templates

Help improve the platform for everyone!

### Ways to Contribute

**1. Fix Typos and Errors**
See a mistake? Submit a quick fix.

**2. Improve Explanations**
Make complex topics clearer.

**3. Add New Templates**
Share useful contract patterns.

**4. Create Tutorials**
Help others learn.

### How to Contribute

**Via GitHub:**

1. Fork the repository
2. Create a branch for your changes
3. Make your edits
4. Submit a pull request

**Via the Platform:**

1. Click "Suggest Edit" on any page
2. Describe your improvement
3. Submit for review

### Template Guidelines

Good templates should:

- Be well-documented
- Follow best practices
- Include tests
- Have clear customization points
- Be gas-efficient

### Documentation Style

- Use clear, simple language
- Include code examples
- Add diagrams when helpful
- Link to related topics

### Recognition

Contributors are recognized:

- Listed on the Contributors page
- GitHub contribution history
- Special badges (for major contributions)

Thank you for helping make Web3 development more accessible!
        `
      }
    ]
  }
];

export default function DocArticlePage() {
  const { categoryId, articleId } = useParams<{ categoryId: string; articleId: string }>();
  
  const category = docCategories.find(c => c.id === categoryId);
  const article = category?.articles.find(a => a.id === articleId);
  
  // Find previous and next articles
  const currentIndex = category?.articles.findIndex(a => a.id === articleId) ?? -1;
  const prevArticle = currentIndex > 0 ? category?.articles[currentIndex - 1] : null;
  const nextArticle = currentIndex < (category?.articles.length ?? 0) - 1 ? category?.articles[currentIndex + 1] : null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!category || !article) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The documentation article you're looking for doesn't exist.
          </p>
          <Link
            to="/docs"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            <Home className="w-5 h-5" />
            <span>Back to Documentation</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm">
            <Link to="/docs" className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Documentation
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <Link 
              to={`/docs/${category.id}`} 
              className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {category.title}
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-900 dark:text-white font-medium">{article.title}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Article Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                {category.icon}
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{category.title}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-4">{article.title}</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">{article.description}</p>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(article.difficulty)}`}>
                {article.difficulty}
              </span>
              <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4 mr-1" />
                {article.readTime} read
              </span>
            </div>
          </div>

          {/* Article Content */}
          <div className="prose dark:prose-invert prose-lg max-w-none mb-12">
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(formatMarkdown(article.content)) 
              }} 
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-8">
            {prevArticle ? (
              <Link
                to={`/docs/${category.id}/${prevArticle.id}`}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm text-gray-400">Previous</div>
                  <div className="font-medium">{prevArticle.title}</div>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {nextArticle ? (
              <Link
                to={`/docs/${category.id}/${nextArticle.id}`}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-right"
              >
                <div>
                  <div className="text-sm text-gray-400">Next</div>
                  <div className="font-medium">{nextArticle.title}</div>
                </div>
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                to="/docs"
                className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Back to all documentation</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </div>

          {/* Sidebar: Related Articles */}
          <div className="mt-12 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <h3 className="font-bold mb-4">More in {category.title}</h3>
            <div className="space-y-2">
              {category.articles
                .filter(a => a.id !== article.id)
                .slice(0, 4)
                .map(a => (
                  <Link
                    key={a.id}
                    to={`/docs/${category.id}/${a.id}`}
                    className="block p-3 bg-white dark:bg-gray-700 rounded-lg hover:shadow-md transition-all"
                  >
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{a.readTime}</div>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple markdown to HTML formatter
function formatMarkdown(content: string): string {
  return content
    // Code blocks first (before other transformations)
    .replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre class="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto my-4 text-sm"><code>$2</code></pre>')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    // Tables
    .replace(/\|(.+)\|/gim, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.match(/^[-:]+$/))) {
        return ''; // Skip separator row
      }
      const cellsHtml = cells.map(c => `<td class="border border-gray-300 dark:border-gray-600 px-3 py-2">${c.trim()}</td>`).join('');
      return `<tr>${cellsHtml}</tr>`;
    })
    // Inline code
    .replace(/`([^`]+)`/gim, '<code class="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/gim, '<strong>$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')
    // Unordered lists
    .replace(/^- (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 mb-1 list-decimal">$1</li>')
    // Checkboxes
    .replace(/\[ \]/g, '☐')
    .replace(/\[x\]/gi, '☑')
    // Paragraphs
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      if (block.startsWith('☐') || block.startsWith('☑')) return `<p class="mb-2">${block}</p>`;
      return `<p class="mb-4">${block}</p>`;
    })
    .join('\n');
}
