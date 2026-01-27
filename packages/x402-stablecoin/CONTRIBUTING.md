# Contributing to X402

Thank you for your interest in contributing to X402! We're excited to have you join our community of developers building the future of AI agent payments.

---

## 🌟 Welcome

### Project Vision

X402 is building the payment infrastructure for the AI agent economy. We combine HTTP 402 payment-required responses with yield-bearing USDs stablecoin to enable:

- **Frictionless micropayments** between AI agents and APIs
- **Automatic yield earning** on payment float
- **Gasless transactions** via EIP-3009 authorizations
- **Open standards** that any developer can build upon

We believe payments should be as easy as HTTP requests, and contributors like you make this vision possible.

### Getting Help

- **Discord**: Join our community at [discord.gg/x402](https://discord.gg/x402) for real-time discussions
- **GitHub Discussions**: Ask questions and share ideas in [Discussions](https://github.com/nirholas/x402/discussions)
- **GitHub Issues**: Report bugs or request features via [Issues](https://github.com/nirholas/x402/issues)
- **Twitter/X**: Follow [@x402protocol](https://twitter.com/x402protocol) for updates

### Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). We're committed to providing a welcoming and inclusive environment for everyone.

---

## 🛠️ Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** 8+ (`npm install -g pnpm`)
- **Foundry** (for Solidity development) ([Install](https://book.getfoundry.sh/getting-started/installation))
- **Git** 2.30+ ([Download](https://git-scm.com/))

### Complete Local Setup

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/x402.git
cd x402

# 2. Add upstream remote
git remote add upstream https://github.com/nirholas/x402.git

# 3. Install dependencies
pnpm install

# 4. Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 5. Install Solidity dependencies
cd contracts && forge install && cd ..

# 6. Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see below)

# 7. Build all packages
pnpm build

# 8. Run all tests to verify setup
pnpm test
pnpm contracts:test
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Arbitrum RPC (get from Alchemy/Infura)
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Private key for local testing (use test wallet only!)
PRIVATE_KEY=0x...

# Facilitator server
FACILITATOR_PORT=3002
FACILITATOR_URL=http://localhost:3002

# USDs token address (Arbitrum mainnet)
USDS_ADDRESS=0xD74f5255D557944cf7Dd0E45FF521520002D5748

# Optional: Etherscan API key for contract verification
ARBISCAN_API_KEY=

# Optional: Sperax API for yield data
SPERAX_API_URL=https://api.sperax.io
```

### IDE Recommendations

#### VS Code (Recommended)

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "JuanBlanco.solidity",
    "NomicFoundation.hardhat-solidity",
    "bradlc.vscode-tailwindcss",
    "Gruntfuggly.todo-tree",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker",
    "GitHub.copilot",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**Workspace settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[solidity]": {
    "editor.defaultFormatter": "JuanBlanco.solidity"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["typescript", "typescriptreact"],
  "solidity.compileUsingRemoteVersion": "v0.8.20"
}
```

### Debugging Tips

#### TypeScript Debugging

1. Add a VS Code launch configuration:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Facilitator",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/facilitator/src/server.ts",
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

2. Set breakpoints and press F5 to start debugging

#### Solidity Debugging

```bash
# Run tests with verbose output
forge test -vvvv

# Run specific test with traces
forge test --match-test testPayment -vvvv

# Debug a specific transaction
forge debug --match-test testPayment
```

#### Common Issues

| Issue | Solution |
|-------|----------|
| `pnpm install` fails | Delete `node_modules` and `pnpm-lock.yaml`, run again |
| Forge tests fail | Run `forge install` in `/contracts` |
| Type errors | Run `pnpm typecheck` and check imports |
| RPC errors | Verify your `ARBITRUM_RPC_URL` is valid |

---

## 🔄 Contribution Workflow

### Fork and Branch Strategy

```bash
# 1. Sync your fork with upstream
git checkout main
git fetch upstream
git merge upstream/main

# 2. Create a feature branch from main
git checkout -b feature/your-feature-name

# Branch naming conventions:
# - feature/description - New features
# - fix/description     - Bug fixes
# - docs/description    - Documentation updates
# - refactor/description - Code refactoring
# - test/description    - Test improvements
```

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear, machine-readable commit history:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | New feature for users |
| `fix` | Bug fix for users |
| `docs` | Documentation changes |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `perf` | Performance improvements |
| `test` | Adding or fixing tests |
| `build` | Build system or dependencies |
| `ci` | CI configuration changes |
| `chore` | Other changes (tooling, etc.) |

**Scopes:** `sdk`, `facilitator`, `contracts`, `cli`, `yield-tracker`, `docs`

**Examples:**

```bash
feat(sdk): add gasless payment support for EIP-3009
fix(contracts): resolve reentrancy in channel close
docs(readme): update quick start guide
test(facilitator): add payment verification tests
```

### Pull Request Process

1. **Ensure your branch is up to date:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run the full test suite:**
   ```bash
   pnpm test
   pnpm contracts:test
   pnpm lint
   pnpm typecheck
   ```

3. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a PR on GitHub using our [PR template](.github/PULL_REQUEST_TEMPLATE.md).

4. **PR Checklist:**
   - [ ] Title follows conventional commit format
   - [ ] Description explains the change
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] Breaking changes noted
   - [ ] Linked related issues

### Code Review Process

1. **Automated checks** must pass (CI, linting, tests)
2. **At least one maintainer** must approve
3. **Conversations** must be resolved
4. **Branch must be up to date** with main

**Review timeline:**
- First review: Within 48 hours
- Follow-up reviews: Within 24 hours

### CI Checks Explained

Our CI pipeline runs these checks on every PR:

| Check | Description | Fix |
|-------|-------------|-----|
| **Type Check** | TypeScript compilation | `pnpm typecheck` |
| **Lint** | ESLint code quality | `pnpm lint --fix` |
| **Build** | Package compilation | `pnpm build` |
| **Test** | Jest unit tests | `pnpm test` |
| **Contracts Build** | Solidity compilation | `forge build` |
| **Contracts Test** | Foundry tests | `forge test` |
| **Security** | Slither analysis | Review security findings |

---

## 📝 Code Standards

### TypeScript Style Guide

```typescript
// ✅ Use explicit types
function calculatePayment(amount: bigint, fee: bigint): bigint {
  return amount + fee;
}

// ✅ Prefer const and readonly
const MAX_RETRIES = 3;
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✅ Use async/await over Promises
async function fetchBalance(address: string): Promise<bigint> {
  const response = await client.getBalance(address);
  return response.balance;
}

// ✅ Meaningful variable names
const paymentChannelId = generateChannelId();
const totalYieldEarned = calculateYield(deposits);

// ✅ Error handling with custom errors
class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly txHash?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// ✅ Document public APIs with JSDoc
/**
 * Creates a payment authorization for gasless transfer.
 * @param recipient - Address to receive payment
 * @param amount - Amount in USDs (wei)
 * @param deadline - Unix timestamp for expiration
 * @returns Signed authorization object
 * @throws {PaymentError} If signing fails
 */
async function createAuthorization(
  recipient: string,
  amount: bigint,
  deadline: number
): Promise<Authorization> {
  // Implementation
}
```

**Additional TypeScript rules:**

- Enable strict mode in `tsconfig.json`
- No `any` types without explicit reason
- Prefer `unknown` over `any` for dynamic data
- Use `type` for unions/intersections, `interface` for objects
- Export types alongside implementations

### Solidity Style Guide

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ExampleContract
 * @author X402 Protocol
 * @notice Brief description of what this contract does
 * @dev Implementation details and notes for developers
 */
contract ExampleContract is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice USDs token address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Total deposits in the contract
    uint256 public totalDeposits;

    /// @notice Mapping of user addresses to their balances
    mapping(address => uint256) public balances;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a deposit is made
    /// @param user Address of the depositor
    /// @param amount Amount deposited
    event Deposited(address indexed user, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when deposit amount is zero
    error ZeroDeposit();

    /// @notice Thrown when user has insufficient balance
    /// @param requested Amount requested
    /// @param available Amount available
    error InsufficientBalance(uint256 requested, uint256 available);

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposits USDs into the contract
     * @param amount Amount to deposit
     * @return success Whether the deposit succeeded
     */
    function deposit(uint256 amount) external nonReentrant returns (bool success) {
        if (amount == 0) revert ZeroDeposit();

        // Effects
        balances[msg.sender] += amount;
        totalDeposits += amount;

        // Interactions
        IERC20(USDS).transferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, amount);
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Internal helper for balance updates
    function _updateBalance(address user, uint256 amount) internal {
        balances[user] = amount;
    }
}
```

**Solidity conventions:**

- Use NatSpec for all public functions
- Follow Checks-Effects-Interactions pattern
- Use custom errors instead of require strings
- Group code with section headers
- Order: Constants → State → Events → Errors → Functions
- Use `indexed` for event parameters used in filtering

### Documentation Requirements

**Code documentation:**
- All public functions must have JSDoc/NatSpec
- Complex logic needs inline comments
- README.md for each package

**PR documentation:**
- Describe the change and motivation
- Include usage examples for new features
- Update relevant docs and README files

### Test Requirements

**TypeScript tests (Jest):**

```typescript
describe('PaymentService', () => {
  describe('createPayment', () => {
    it('should create a valid payment authorization', async () => {
      const payment = await service.createPayment({
        recipient: '0x...',
        amount: BigInt('1000000000000000000'),
      });

      expect(payment.signature).toBeDefined();
      expect(payment.deadline).toBeGreaterThan(Date.now());
    });

    it('should throw PaymentError for invalid recipient', async () => {
      await expect(
        service.createPayment({
          recipient: 'invalid-address',
          amount: BigInt('1000000000000000000'),
        })
      ).rejects.toThrow(PaymentError);
    });
  });
});
```

**Solidity tests (Foundry):**

```solidity
contract PaymentChannelTest is Test {
    X402PaymentChannel public channel;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        channel = new X402PaymentChannel();
        deal(USDS, alice, 1000 ether);
    }

    function test_OpenChannel() public {
        vm.startPrank(alice);
        IERC20(USDS).approve(address(channel), 100 ether);
        
        bytes32 channelId = channel.openChannel(bob, 100 ether);
        
        assertEq(channel.getChannelBalance(channelId), 100 ether);
        vm.stopPrank();
    }

    function testFuzz_DepositAmount(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1000 ether);
        // Fuzz test implementation
    }
}
```

**Coverage requirements:**
- TypeScript: 80% minimum
- Solidity: 90% minimum for critical paths

---

## 🎯 Areas for Contribution

### Good First Issues

Look for issues labeled [`good first issue`](https://github.com/nirholas/x402/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22):

- Documentation improvements
- Code comment cleanup
- Simple bug fixes
- Test coverage improvements
- Typo fixes

### Help Wanted Areas

Issues labeled [`help wanted`](https://github.com/nirholas/x402/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22):

- **SDK Enhancements**: Additional chain support, new payment methods
- **Facilitator Features**: Performance optimization, caching
- **Contract Improvements**: Gas optimization, new features
- **Documentation**: Tutorials, guides, API docs
- **Examples**: Integration examples, demo apps

### Feature Roadmap

Areas we're actively developing:

| Area | Priority | Description |
|------|----------|-------------|
| **Multi-chain** | High | Support for Base, Optimism, Polygon |
| **Subscriptions** | High | Recurring payment channels |
| **Revenue Splitting** | Medium | Multi-party payment distribution |
| **Analytics Dashboard** | Medium | Yield tracking and payment history |
| **SDK Plugins** | Low | Framework-specific integrations |

Want to work on a roadmap item? Open an issue to discuss the approach first.

### Types of Contributions

- **Code**: Features, bug fixes, optimizations
- **Documentation**: Guides, tutorials, API docs
- **Testing**: Unit tests, integration tests, fuzzing
- **Security**: Auditing, vulnerability reports
- **Design**: UI/UX for web components
- **Community**: Answering questions, reviews

---

## 🏗️ Project Structure

```
x402/
├── packages/             # Published npm packages
│   └── sdk/             # @x402/sdk - Core SDK
├── facilitator/         # Payment verification server
│   ├── src/
│   │   ├── server.ts    # Express server entry
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── middleware/  # Auth, validation
├── yield-tracker/       # USDs yield monitoring
├── cli/                 # Command-line interface
├── contracts/           # Solidity smart contracts
│   ├── src/            # Contract source files
│   ├── test/           # Foundry tests
│   └── script/         # Deployment scripts
├── sperax/             # Sperax integration & MCP tools
├── web-app/            # Web components
├── examples/           # Integration examples
│   ├── quick-start/    # Basic example
│   └── ai-agent/       # AI integration
└── docs/               # Documentation
```

---

## 🔐 Security

If you discover a security vulnerability, please **DO NOT** open a public issue. See our [Security Policy](SECURITY.md) for responsible disclosure procedures.

---

## 📜 License

By contributing to X402, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

## 🙏 Thank You!

Every contribution, no matter how small, makes X402 better. We appreciate your time and effort in helping us build the future of AI payments.

Questions? Join us on [Discord](https://discord.gg/x402) or open a [Discussion](https://github.com/nirholas/x402/discussions)!
