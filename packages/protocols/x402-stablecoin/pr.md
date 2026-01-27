

### Agent 5: CLI Tool

```
You are building a command-line interface for X402 payments at /workspaces/x402.

## Your Task
Create a CLI tool in `/workspaces/x402/cli/` for interacting with X402 USDs payments from the terminal.

1. **Commands to implement:**

```bash
# Initialize configuration
x402 init

# Make a payment
x402 pay <recipient> <amount> [--token USDs] [--gasless]

# Check balance and yield
x402 balance [address]
x402 yield [address]

# Tool operations
x402 tools list
x402 tools call <tool-name> [--args ...]
x402 tools register <name> <price>

# Payment history
x402 history [--limit 10]
x402 tx <txHash>

# Configuration
x402 config set <key> <value>
x402 config get <key>
x402 config list
```

2. **Files to create:**
   - `cli/src/index.ts` - Main entry with Commander.js
   - `cli/src/commands/init.ts` - Initialize config
   - `cli/src/commands/pay.ts` - Payment command
   - `cli/src/commands/balance.ts` - Balance check
   - `cli/src/commands/yield.ts` - Yield info
   - `cli/src/commands/tools.ts` - Tool operations
   - `cli/src/commands/history.ts` - Payment history
   - `cli/src/commands/config.ts` - Configuration
   - `cli/src/lib/client.ts` - X402 client wrapper
   - `cli/src/lib/config.ts` - Config file management (~/.x402/config.json)
   - `cli/src/lib/display.ts` - Pretty terminal output (chalk, ora)
   - `cli/src/types.ts`
   - `cli/package.json` - bin: { "x402": "./dist/index.js" }
   - `cli/tsconfig.json`
   - `cli/README.md`

3. **Features:**
   - Interactive prompts with inquirer
   - Colorful output with chalk
   - Loading spinners with ora
   - Table output for history/tools
   - Secure key storage (keytar or encrypted file)
   - Network selection (mainnet/sepolia)

4. **Example Usage:**
```bash
$ x402 init
✓ Configuration created at ~/.x402/config.json
? Enter your private key: ****
? Select network: Arbitrum Mainnet
✓ Connected to Arbitrum

$ x402 balance
💰 USDs Balance: 1,234.56 USDs
📈 Yield Earned: +12.34 USDs (1.0% this month)
🌐 Network: Arbitrum Mainnet

