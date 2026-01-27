/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Lyra AI Chat Service
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * 📦 github.com/nirholas/lyra-web3-playground | 🌐 https://lyra.works
 * Copyright (c) 2024-2026 nirholas (nich) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Lyra AI Chat Service
 * 
 * A free, no-API-key-required AI assistant for Web3 and smart contract questions.
 * Uses intelligent pattern matching and a comprehensive knowledge base to provide
 * helpful, contextual responses about Solidity, smart contracts, DeFi, and blockchain.
 * 
 * Built by nich - x.com/nichxbt - github.com/nirholas
 */

// Attribution marker - nich | x.com/nichxbt | github.com/nirholas
const __lyra_attr__ = 'nich:nichxbt:nirholas';

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp?: number;
}

export interface LyraResponse {
  message: string;
  codeExample?: string;
  relatedTopics?: string[];
}

// =============================================================================
// KNOWLEDGE BASE
// =============================================================================

interface KnowledgeEntry {
  patterns: RegExp[];
  response: string;
  codeExample?: string;
  relatedTopics?: string[];
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // Solidity Basics
  {
    patterns: [
      /what is solidity/i,
      /solidity basics/i,
      /explain solidity/i,
      /learn solidity/i,
    ],
    response: `Solidity is a statically-typed programming language designed for developing smart contracts on Ethereum and EVM-compatible blockchains. It's influenced by C++, Python, and JavaScript.

**Key Features:**
• Contract-oriented (similar to classes in OOP)
• Static typing with compile-time checking
• Supports inheritance and libraries
• Built-in support for cryptographic functions

Getting started is easy - you just need a Solidity compiler (solc) or an IDE like Remix!`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message = "Hello, Web3!";
    
    function setMessage(string memory newMessage) public {
        message = newMessage;
    }
}`,
    relatedTopics: ['Smart Contracts', 'EVM', 'Remix IDE', 'pragma directive'],
  },
  
  // Mappings
  {
    patterns: [
      /mapping/i,
      /key.?value/i,
      /how to store.*address/i,
      /balance.*address/i,
    ],
    response: `Mappings in Solidity are like hash tables or dictionaries - they store key-value pairs. They're perfect for tracking balances, ownership, or any data associated with addresses.

**Key Points:**
• Keys can be any elementary type (address, uint, bytes32)
• Values can be any type including structs and arrays
• Mappings don't have length and can't be iterated directly
• All possible keys exist by default (with zero/default values)`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BalanceTracker {
    // Simple mapping: address => balance
    mapping(address => uint256) public balances;
    
    // Nested mapping: address => (address => allowance)
    mapping(address => mapping(address => uint256)) public allowances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
}`,
    relatedTopics: ['Storage', 'Gas Optimization', 'Arrays vs Mappings'],
  },
  
  // require & assert
  {
    patterns: [
      /require/i,
      /assert/i,
      /revert/i,
      /validation/i,
      /check.*condition/i,
      /input.*validation/i,
    ],
    response: `Solidity provides three error handling functions: \`require\`, \`assert\`, and \`revert\`.

**require(condition, "error message")**
• Best for input validation and access control
• Refunds remaining gas on failure
• Returns an error message

**assert(condition)**
• For internal errors and invariants
• Consumes all gas on failure
• Use for things that should NEVER be false

**revert("error message")**
• Explicit revert with custom message
• Useful in complex conditional logic`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ValidationExample {
    address public owner;
    uint256 public balance;
    
    constructor() {
        owner = msg.sender;
    }
    
    function withdraw(uint256 amount) public {
        // Input validation with require
        require(msg.sender == owner, "Only owner can withdraw");
        require(amount > 0, "Amount must be positive");
        require(amount <= balance, "Insufficient balance");
        
        balance -= amount;
        
        // Internal invariant check with assert
        assert(balance >= 0); // Should always be true
        
        payable(owner).transfer(amount);
    }
}`,
    relatedTopics: ['Error Handling', 'Custom Errors', 'Gas Optimization'],
  },
  
  // ERC-20 Tokens
  {
    patterns: [
      /erc.?20/i,
      /token standard/i,
      /create.*token/i,
      /fungible token/i,
      /how.*token.*work/i,
    ],
    response: `ERC-20 is the most widely used token standard on Ethereum. It defines a common interface that all fungible tokens must implement.

**Required Functions:**
• \`totalSupply()\` - Total token supply
• \`balanceOf(address)\` - Balance of an account  
• \`transfer(to, amount)\` - Send tokens
• \`approve(spender, amount)\` - Allow spending
• \`transferFrom(from, to, amount)\` - Spend allowed tokens
• \`allowance(owner, spender)\` - Check allowance

**Events:**
• \`Transfer(from, to, value)\`
• \`Approval(owner, spender, value)\``,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
    
    // Optional: Allow owner to mint new tokens
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    // Optional: Allow users to burn their tokens
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}`,
    relatedTopics: ['OpenZeppelin', 'Token Minting', 'Token Burning', 'ERC-721'],
  },
  
  // NFTs / ERC-721
  {
    patterns: [
      /nft/i,
      /erc.?721/i,
      /non.?fungible/i,
      /collectible/i,
      /mint.*nft/i,
    ],
    response: `ERC-721 is the standard for Non-Fungible Tokens (NFTs) - unique digital assets on the blockchain.

**Key Differences from ERC-20:**
• Each token has a unique ID (tokenId)
• Tokens are not interchangeable
• Often linked to metadata (images, attributes)

**Core Functions:**
• \`balanceOf(owner)\` - Count of NFTs owned
• \`ownerOf(tokenId)\` - Owner of specific NFT
• \`safeTransferFrom(from, to, tokenId)\` - Safe transfer
• \`approve(to, tokenId)\` - Approve transfer
• \`tokenURI(tokenId)\` - Metadata URL`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    uint256 public mintPrice = 0.01 ether;
    uint256 public maxSupply = 10000;

    constructor() ERC721("MyNFT", "MNFT") {}

    function mint(string memory tokenURI) public payable returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_tokenIds.current() < maxSupply, "Max supply reached");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        return newTokenId;
    }
}`,
    relatedTopics: ['Metadata', 'IPFS', 'OpenSea', 'ERC-1155'],
  },
  
  // Gas Optimization
  {
    patterns: [
      /gas/i,
      /optimi[sz]/i,
      /efficient/i,
      /save.*gas/i,
      /reduce.*cost/i,
    ],
    response: `Gas optimization is crucial for cost-effective smart contracts. Here are the top techniques:

**Storage Optimization:**
• Use smaller integer types when possible (uint8 vs uint256)
• Pack variables to use fewer storage slots
• Use \`calldata\` instead of \`memory\` for read-only params

**Code Optimization:**
• Cache storage variables in memory for loops
• Use \`++i\` instead of \`i++\`
• Short-circuit conditionals (cheap checks first)
• Use custom errors instead of strings

**Design Patterns:**
• Batch operations to save base transaction costs
• Use events instead of storing non-essential data`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GasOptimized {
    // ❌ Bad: Uses multiple storage slots
    // uint256 a; uint256 b; uint256 c;
    
    // ✅ Good: Pack into one slot (32 bytes)
    uint128 public a;
    uint64 public b;
    uint64 public c;
    
    // Custom error (cheaper than string)
    error InsufficientBalance(uint256 available, uint256 required);
    
    // Use calldata for read-only external params
    function processData(uint256[] calldata data) external pure returns (uint256) {
        uint256 sum = 0;
        uint256 length = data.length; // Cache length
        
        for (uint256 i = 0; i < length; ) {
            sum += data[i];
            unchecked { ++i; } // Save gas on increment
        }
        return sum;
    }
}`,
    relatedTopics: ['Storage Layout', 'EIP-2929', 'Unchecked Blocks'],
  },
  
  // Security
  {
    patterns: [
      /security/i,
      /reentrancy/i,
      /vulnerability/i,
      /attack/i,
      /audit/i,
      /hack/i,
      /safe/i,
    ],
    response: `Smart contract security is critical since deployed contracts are immutable and handle real value. Key vulnerabilities to avoid:

**Reentrancy Attack:**
• External calls can call back into your contract
• Solution: Use Checks-Effects-Interactions pattern

**Integer Overflow/Underflow:**
• Solidity 0.8+ has built-in checks
• For older versions, use SafeMath

**Access Control:**
• Always validate msg.sender
• Use OpenZeppelin's Ownable or AccessControl

**Front-Running:**
• Transactions in mempool are public
• Use commit-reveal schemes for sensitive operations`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureVault is ReentrancyGuard {
    mapping(address => uint256) public balances;
    
    // Checks-Effects-Interactions Pattern
    function withdraw(uint256 amount) external nonReentrant {
        // 1. CHECKS
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // 2. EFFECTS (update state BEFORE external call)
        balances[msg.sender] -= amount;
        
        // 3. INTERACTIONS (external call LAST)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
}`,
    relatedTopics: ['Audits', 'OpenZeppelin', 'Slither', 'Formal Verification'],
  },
  
  // DeFi Basics
  {
    patterns: [
      /defi/i,
      /decentralized finance/i,
      /yield/i,
      /liquidity/i,
      /amm/i,
      /swap/i,
    ],
    response: `DeFi (Decentralized Finance) recreates traditional financial services using smart contracts, removing intermediaries.

**Core DeFi Primitives:**
• **DEXs (Uniswap):** Automated Market Makers for token swaps
• **Lending (Aave, Compound):** Borrow/lend with overcollateralization
• **Stablecoins (DAI):** Price-stable cryptocurrencies
• **Yield Farming:** Earning rewards by providing liquidity

**Key Concepts:**
• TVL (Total Value Locked) - Assets deposited in protocols
• APY - Annual Percentage Yield
• Impermanent Loss - Risk in liquidity providing
• Flash Loans - Uncollateralized loans within one transaction`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Simple AMM Swap Example (Constant Product: x * y = k)
contract SimpleSwap {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    
    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        
        bool isTokenA = tokenIn == address(tokenA);
        (uint256 resIn, uint256 resOut) = isTokenA 
            ? (reserveA, reserveB) 
            : (reserveB, reserveA);
        
        // Constant product formula: (x + dx) * (y - dy) = x * y
        // dy = (y * dx) / (x + dx)
        amountOut = (resOut * amountIn) / (resIn + amountIn);
        
        // Update reserves and transfer tokens
        // ... (transfer logic)
    }
}`,
    relatedTopics: ['Uniswap', 'Aave', 'Flash Loans', 'Yield Farming'],
  },
  
  // Events & Logging
  {
    patterns: [
      /event/i,
      /emit/i,
      /log/i,
      /indexed/i,
      /listen/i,
    ],
    response: `Events in Solidity are a way to log data to the blockchain that external applications can listen to. They're much cheaper than storage!

**Key Points:**
• Events are stored in transaction logs (not state)
• Up to 3 parameters can be \`indexed\` for filtering
• Frontend apps use web3.js/ethers.js to subscribe
• Perfect for tracking historical actions

**Common Uses:**
• Token transfers (Transfer event)
• State changes (OwnershipTransferred)
• User actions (Deposit, Withdraw)`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EventExample {
    // Define events
    event Transfer(
        address indexed from,    // indexed = filterable
        address indexed to,
        uint256 value
    );
    
    event NewUser(
        address indexed user,
        string username,
        uint256 timestamp
    );
    
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Emit the event
        emit Transfer(msg.sender, to, amount);
    }
}

// Frontend code to listen:
// contract.on("Transfer", (from, to, value) => {
//     console.log(\`Transfer: \${from} -> \${to}: \${value}\`);
// });`,
    relatedTopics: ['ethers.js', 'web3.js', 'The Graph', 'Indexing'],
  },
  
  // Modifiers
  {
    patterns: [
      /modifier/i,
      /onlyowner/i,
      /access control/i,
      /permission/i,
    ],
    response: `Modifiers in Solidity are reusable code that can run before and/or after a function. They're perfect for access control and validation!

**Common Uses:**
• Access control (onlyOwner, onlyAdmin)
• Input validation (validAddress)
• State checks (whenNotPaused)
• Reentrancy guards

**The \`_\` Symbol:**
• Represents where the function body executes
• Code before \`_\` runs first
• Code after \`_\` runs after the function`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ModifierExample {
    address public owner;
    bool public paused;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Access control modifier
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _; // Function body executes here
    }
    
    // State check modifier  
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    // Validation modifier
    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }
    
    // Using multiple modifiers
    function transfer(address to, uint256 amount) 
        external 
        whenNotPaused 
        validAddress(to) 
    {
        // Transfer logic here
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
}`,
    relatedTopics: ['OpenZeppelin Ownable', 'Role-Based Access', 'Pausable'],
  },
  
  // Constructor & Deployment
  {
    patterns: [
      /constructor/i,
      /deploy/i,
      /initial/i,
      /setup/i,
    ],
    response: `The constructor in Solidity is a special function that runs exactly once when the contract is deployed.

**Key Points:**
• Only called during deployment
• Cannot be called again after deployment
• Can accept parameters for initialization
• Commonly used to set owner and initial state

**Deployment Options:**
• Remix IDE (browser-based)
• Hardhat (JavaScript/TypeScript)
• Foundry (Rust-based, very fast)
• Truffle (JavaScript)`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    address public owner;
    string public name;
    uint256 public createdAt;
    uint256 public maxSupply;
    
    // Constructor with parameters
    constructor(string memory _name, uint256 _maxSupply) {
        owner = msg.sender;  // Deployer becomes owner
        name = _name;
        maxSupply = _maxSupply;
        createdAt = block.timestamp;
    }
    
    // Alternative: Initialize with payable to accept ETH
    constructor() payable {
        owner = msg.sender;
    }
}

// Deploying with Hardhat:
// const MyContract = await ethers.getContractFactory("MyContract");
// const contract = await MyContract.deploy("MyToken", 1000000);
// await contract.deployed();`,
    relatedTopics: ['Hardhat', 'Foundry', 'Remix', 'Verification'],
  },
  
  // Structs
  {
    patterns: [
      /struct/i,
      /custom type/i,
      /complex data/i,
      /group.*data/i,
    ],
    response: `Structs in Solidity let you define custom data types by grouping related variables together.

**Key Points:**
• Similar to structs in C or classes in other languages
• Can contain multiple data types
• Can be used in mappings and arrays
• Great for organizing related data

**Memory vs Storage:**
• Structs in storage persist on blockchain
• Structs in memory are temporary
• Use \`storage\` keyword to reference existing data`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StructExample {
    // Define a struct
    struct User {
        address wallet;
        string username;
        uint256 balance;
        uint256 joinedAt;
        bool isActive;
    }
    
    // Mapping of address to User struct
    mapping(address => User) public users;
    
    // Array of all users
    User[] public allUsers;
    
    function createUser(string memory _username) external {
        User memory newUser = User({
            wallet: msg.sender,
            username: _username,
            balance: 0,
            joinedAt: block.timestamp,
            isActive: true
        });
        
        users[msg.sender] = newUser;
        allUsers.push(newUser);
    }
    
    // Modify a stored struct (use storage keyword)
    function deactivateUser(address _user) external {
        User storage user = users[_user];
        user.isActive = false;
    }
}`,
    relatedTopics: ['Mappings', 'Arrays', 'Storage Layout'],
  },
  
  // Inheritance
  {
    patterns: [
      /inherit/i,
      /extend/i,
      /override/i,
      /virtual/i,
      /parent.*contract/i,
      /base.*contract/i,
    ],
    response: `Solidity supports multiple inheritance, allowing contracts to inherit functionality from other contracts.

**Key Concepts:**
• \`is\` keyword to inherit
• \`virtual\` functions can be overridden
• \`override\` keyword required when overriding
• \`super\` to call parent functions
• Inheritance order matters (linearization)

**Common Patterns:**
• Inherit from OpenZeppelin contracts
• Create base contracts for shared logic
• Interface inheritance for standards`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Base contract
contract Ownable {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // virtual = can be overridden
    function transferOwnership(address newOwner) public virtual onlyOwner {
        owner = newOwner;
    }
}

// Another base contract
contract Pausable is Ownable {
    bool public paused;
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
}

// Child contract inheriting from both
contract MyToken is Ownable, Pausable {
    mapping(address => uint256) public balances;
    
    // Override with additional logic
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid address");
        super.transferOwnership(newOwner); // Call parent
    }
    
    function transfer(address to, uint256 amount) external whenNotPaused {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}`,
    relatedTopics: ['Interfaces', 'Abstract Contracts', 'Diamond Inheritance'],
  },
  
  // Interfaces
  {
    patterns: [
      /interface/i,
      /interact.*contract/i,
      /call.*external/i,
      /other.*contract/i,
    ],
    response: `Interfaces in Solidity define function signatures without implementation. They're essential for interacting with other contracts!

**Key Points:**
• Cannot have state variables
• Cannot have constructors
• All functions must be external
• Cannot have any implementation
• Used to interact with deployed contracts

**Common Uses:**
• Interact with ERC-20/721 tokens
• Call other protocols (Uniswap, Aave)
• Define standards and APIs`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interface for ERC20 tokens
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TokenSwap {
    // Use interface to interact with any ERC20 token
    function swapTokens(
        address tokenA,
        address tokenB,
        uint256 amountA
    ) external {
        // Create interface instances
        IERC20 tokenAContract = IERC20(tokenA);
        IERC20 tokenBContract = IERC20(tokenB);
        
        // Transfer tokenA from user to this contract
        tokenAContract.transferFrom(msg.sender, address(this), amountA);
        
        // Calculate amountB (simplified)
        uint256 amountB = amountA; // 1:1 for example
        
        // Send tokenB to user
        tokenBContract.transfer(msg.sender, amountB);
    }
}`,
    relatedTopics: ['ERC-20', 'External Calls', 'Low-Level Calls'],
  },
  
  // msg.sender, msg.value, block
  {
    patterns: [
      /msg\.sender/i,
      /msg\.value/i,
      /block\./i,
      /global variable/i,
      /transaction.*context/i,
    ],
    response: `Solidity provides global variables that give information about the transaction and blockchain state.

**Transaction Context (msg):**
• \`msg.sender\` - Address calling the function
• \`msg.value\` - ETH sent with the call (in wei)
• \`msg.data\` - Complete calldata

**Block Information:**
• \`block.timestamp\` - Current block timestamp
• \`block.number\` - Current block number
• \`block.chainid\` - Current chain ID

**Address Properties:**
• \`address(this).balance\` - Contract's ETH balance
• \`tx.origin\` - Original transaction sender (avoid using!)`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GlobalsExample {
    address public owner;
    uint256 public deployedAt;
    
    event Received(address sender, uint256 amount, uint256 timestamp);
    
    constructor() {
        owner = msg.sender;          // Deployer's address
        deployedAt = block.timestamp; // Deployment time
    }
    
    // Accept ETH and log the transaction
    receive() external payable {
        emit Received(
            msg.sender,      // Who sent ETH
            msg.value,       // How much ETH (in wei)
            block.timestamp  // When
        );
    }
    
    function getInfo() external view returns (
        address caller,
        uint256 contractBalance,
        uint256 blockNum,
        uint256 chainId
    ) {
        return (
            msg.sender,
            address(this).balance,
            block.number,
            block.chainid
        );
    }
    
    // WARNING: Avoid tx.origin for auth!
    // It returns the EOA that started the transaction,
    // which can enable phishing attacks
}`,
    relatedTopics: ['Payable Functions', 'Receive/Fallback', 'wei/gwei/ether'],
  },
  
  // Payable & ETH
  {
    patterns: [
      /payable/i,
      /send.*eth/i,
      /receive.*eth/i,
      /transfer.*eth/i,
      /withdraw/i,
      /deposit/i,
    ],
    response: `The \`payable\` keyword in Solidity allows functions and addresses to receive ETH.

**Sending ETH:**
• \`addr.transfer(amount)\` - Reverts on failure, 2300 gas limit
• \`addr.send(amount)\` - Returns bool, 2300 gas limit
• \`addr.call{value: amount}("")\` - Recommended, forwards all gas

**Receiving ETH:**
• \`receive()\` - Called for plain ETH transfers
• \`fallback()\` - Called when no function matches

**Best Practices:**
• Use \`call\` for sending ETH
• Always check return values
• Implement withdraw patterns over push payments`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ETHHandler {
    mapping(address => uint256) public balances;
    
    // Accept ETH deposits
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
    }
    
    // Withdraw ETH (pull pattern - recommended)
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Update state BEFORE external call (prevent reentrancy)
        balances[msg.sender] -= amount;
        
        // Use call to send ETH (recommended method)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // Receive ETH when no data is sent
    receive() external payable {
        balances[msg.sender] += msg.value;
    }
    
    // Fallback for calls with data but no matching function
    fallback() external payable {
        balances[msg.sender] += msg.value;
    }
    
    // Get contract balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}`,
    relatedTopics: ['Reentrancy', 'Pull vs Push', 'Gas Limits'],
  },
  
  // Arrays
  {
    patterns: [
      /array/i,
      /list/i,
      /push/i,
      /pop/i,
      /dynamic.*array/i,
    ],
    response: `Solidity supports both fixed-size and dynamic arrays for storing collections of elements.

**Fixed Arrays:**
• \`uint256[5] arr\` - Array of exactly 5 elements
• More gas-efficient when size is known

**Dynamic Arrays:**
• \`uint256[] arr\` - Variable length array
• \`push()\` to add elements
• \`pop()\` to remove last element
• \`delete arr[i]\` doesn't resize (sets to 0)

**Memory vs Storage:**
• Storage arrays persist on blockchain
• Memory arrays are temporary
• Memory arrays have fixed size after creation`,
    codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ArrayExample {
    // Dynamic array in storage
    uint256[] public numbers;
    address[] public users;
    
    // Fixed array
    uint256[3] public fixedArray = [1, 2, 3];
    
    function addNumber(uint256 num) external {
        numbers.push(num);
    }
    
    function removeLastNumber() external {
        require(numbers.length > 0, "Array is empty");
        numbers.pop();
    }
    
    function getNumbers() external view returns (uint256[] memory) {
        return numbers;
    }
    
    function getLength() external view returns (uint256) {
        return numbers.length;
    }
    
    // Memory array example
    function createMemoryArray(uint256 size) external pure returns (uint256[] memory) {
        uint256[] memory arr = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            arr[i] = i * 2;
        }
        return arr;
    }
    
    // WARNING: Deleting doesn't resize!
    function deleteElement(uint256 index) external {
        delete numbers[index]; // Sets to 0, doesn't remove
    }
    
    // Proper removal (swap and pop)
    function removeElement(uint256 index) external {
        require(index < numbers.length, "Index out of bounds");
        numbers[index] = numbers[numbers.length - 1];
        numbers.pop();
    }
}`,
    relatedTopics: ['Gas Costs', 'Storage vs Memory', 'Mappings'],
  },
  
  // Web3.js / Ethers.js
  {
    patterns: [
      /web3\.?js/i,
      /ethers\.?js/i,
      /frontend/i,
      /connect.*frontend/i,
      /javascript.*blockchain/i,
    ],
    response: `ethers.js and web3.js are JavaScript libraries for interacting with Ethereum from your frontend.

**ethers.js (Recommended):**
• Modern, clean API
• Better TypeScript support
• Smaller bundle size
• Excellent documentation

**Key Concepts:**
• Provider - Read-only connection to blockchain
• Signer - Can sign transactions (wallet)
• Contract - Interface to deployed contracts

**Common Operations:**
• Connect wallet
• Read contract state
• Send transactions
• Listen to events`,
    codeExample: `// Using ethers.js v6

import { ethers, BrowserProvider, Contract } from 'ethers';

// Connect to MetaMask
async function connectWallet() {
  if (!window.ethereum) throw new Error('No wallet found');
  
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  console.log('Connected:', address);
  return { provider, signer, address };
}

// Interact with a contract
async function interactWithContract(signer) {
  const contractAddress = '0x...';
  const abi = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ];
  
  const contract = new Contract(contractAddress, abi, signer);
  
  // Read (free, no gas)
  const balance = await contract.balanceOf(signer.address);
  console.log('Balance:', ethers.formatEther(balance));
  
  // Write (costs gas)
  const tx = await contract.transfer(
    '0xRecipient...',
    ethers.parseEther('1.0')
  );
  await tx.wait(); // Wait for confirmation
  
  // Listen to events
  contract.on('Transfer', (from, to, value) => {
    console.log(\`Transfer: \${from} -> \${to}: \${value}\`);
  });
}`,
    relatedTopics: ['MetaMask', 'WalletConnect', 'React Hooks', 'viem'],
  },
  
  // General help
  {
    patterns: [
      /help/i,
      /what can you/i,
      /how do you work/i,
      /capabilities/i,
    ],
    response: `Hi! I'm Lyra, your Web3 coding assistant. I can help you with:

**Smart Contract Development:**
• Solidity syntax and best practices
• ERC standards (ERC-20, ERC-721, ERC-1155)
• Security patterns and vulnerabilities
• Gas optimization techniques

**DeFi Concepts:**
• AMMs, lending protocols, yield farming
• Flash loans and arbitrage
• Liquidity provision

**Frontend Integration:**
• ethers.js and web3.js
• Wallet connections (MetaMask, WalletConnect)
• Reading/writing contract data

**Development Tools:**
• Hardhat, Foundry, Remix
• Testing strategies
• Deployment and verification

Just ask me anything about smart contracts or blockchain development!`,
    relatedTopics: ['Solidity', 'DeFi', 'NFTs', 'Security'],
  },
  
  // Greeting
  {
    patterns: [
      /^hi$/i,
      /^hello$/i,
      /^hey$/i,
      /^good morning/i,
      /^good afternoon/i,
      /^good evening/i,
    ],
    response: `Hello! 👋 I'm Lyra, your AI coding assistant for Web3 and smart contract development.

I can help you with:
• Writing and understanding Solidity code
• ERC standards (tokens, NFTs)
• DeFi concepts and protocols
• Security best practices
• Frontend integration with ethers.js

What would you like to learn about today?`,
  },
];

// =============================================================================
// FALLBACK RESPONSES
// =============================================================================

const FALLBACK_RESPONSES = [
  `That's an interesting question! While I specialize in smart contracts and Web3, I can try to help. Could you provide more context about what you're trying to build?`,
  
  `I'm not sure I have specific information about that, but I'd love to help with your Web3 development! Are you working on smart contracts, DeFi, NFTs, or frontend integration?`,
  
  `Great question! Let me point you in the right direction. For Web3 development, I can help with Solidity, ERC standards, security, and frontend integration. What aspect interests you most?`,
  
  `I'm here to help with blockchain development! While I might not have the exact answer, I can assist with Solidity programming, smart contract patterns, and Web3 integration. What are you building?`,
];

const SMART_CONTRACT_TOPICS = [
  'ERC-20 tokens', 'NFTs (ERC-721)', 'DeFi protocols', 'Gas optimization',
  'Security patterns', 'Access control', 'Upgradeable contracts', 'Events and logging'
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate similarity score between input and pattern
 */
function matchScore(input: string, entry: KnowledgeEntry): number {
  const normalizedInput = input.toLowerCase().trim();
  
  for (const pattern of entry.patterns) {
    if (pattern.test(normalizedInput)) {
      // Higher score for exact matches, lower for partial
      return pattern.source.length / normalizedInput.length;
    }
  }
  return 0;
}

/**
 * Find the best matching knowledge entry
 */
function findBestMatch(input: string): KnowledgeEntry | null {
  let bestMatch: KnowledgeEntry | null = null;
  let bestScore = 0;
  
  for (const entry of KNOWLEDGE_BASE) {
    const score = matchScore(input, entry);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }
  
  return bestScore > 0 ? bestMatch : null;
}

/**
 * Get a random fallback response
 */
function getFallbackResponse(): LyraResponse {
  const response = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
  return {
    message: response,
    relatedTopics: SMART_CONTRACT_TOPICS.slice(0, 4),
  };
}

/**
 * Format code example with markdown
 */
function formatResponse(entry: KnowledgeEntry): LyraResponse {
  let message = entry.response;
  
  if (entry.codeExample) {
    message += `\n\n**Example:**\n\`\`\`solidity\n${entry.codeExample}\n\`\`\``;
  }
  
  return {
    message,
    codeExample: entry.codeExample,
    relatedTopics: entry.relatedTopics,
  };
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Generate a response from Lyra AI
 * 
 * This is the main function to call for chat interactions.
 * It uses pattern matching against a knowledge base to provide
 * helpful responses about smart contracts and Web3.
 */
export async function generateLyraResponse(userMessage: string): Promise<LyraResponse> {
  // Simulate network delay for realistic feel
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // Find best matching knowledge entry
  const match = findBestMatch(userMessage);
  
  if (match) {
    return formatResponse(match);
  }
  
  // Check for code-related keywords to give contextual fallback
  const codeKeywords = ['code', 'function', 'contract', 'write', 'create', 'build', 'make'];
  const hasCodeIntent = codeKeywords.some(kw => userMessage.toLowerCase().includes(kw));
  
  if (hasCodeIntent) {
    return {
      message: `I'd be happy to help you write that! To give you the best code example, could you tell me more about:

1. What type of contract? (Token, NFT, DeFi, etc.)
2. What specific functionality do you need?
3. Any security requirements?

Some popular starting points:
• **ERC-20 Token** - Fungible tokens for payments/governance
• **ERC-721 NFT** - Unique digital collectibles
• **Staking Contract** - Lock tokens to earn rewards
• **Escrow Contract** - Secure payment handling`,
      relatedTopics: ['ERC-20', 'ERC-721', 'DeFi', 'Security'],
    };
  }
  
  return getFallbackResponse();
}

/**
 * Get suggested prompts for the chat interface
 */
export function getSuggestedPrompts(): string[] {
  return [
    'How do I create an ERC-20 token?',
    'Explain mappings in Solidity',
    'What is reentrancy and how do I prevent it?',
    'How do I connect a frontend to my smart contract?',
    'What are the gas optimization best practices?',
    'How do NFTs work in Solidity?',
  ];
}

/**
 * Get the initial greeting message
 */
export function getWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    content: "Hi! I'm Lyra, your AI coding assistant. Ask me anything about smart contracts, Web3, or blockchain development! 🎵",
    role: 'assistant',
    timestamp: Date.now(),
  };
}

export default {
  generateLyraResponse,
  getSuggestedPrompts,
  getWelcomeMessage,
};
