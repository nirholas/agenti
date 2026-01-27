# X402 CLI

A command-line interface for interacting with X402 USDs payments from the terminal.

## Features

- 🔐 **Secure Configuration** - Private keys stored securely
- 💰 **USDs Payments** - Auto-yield stablecoin support
- ⛽ **Gasless Transfers** - EIP-3009 payment authorizations
- 🔧 **Tool Management** - Register and call X402 tools
- 📊 **Yield Tracking** - Monitor USDs auto-yield earnings
- 📜 **Transaction History** - View payment history

## Installation

```bash
# From the repository
cd cli
npm install
npm run build
npm link

# Or install globally (when published)
npm install -g @x402/cli
```

## Quick Start

```bash
# Initialize your wallet
x402 init

# Check your balances
x402 balance

# Make a payment
x402 pay 0x1234...5678 10.00 --token USDs

# View yield information
x402 yield
```

## Commands

### `x402 init`

Initialize CLI configuration with your wallet.

```bash
x402 init
x402 init --force              # Re-initialize
x402 init --network arbitrum-sepolia  # Use testnet
```

### `x402 pay`

Make a payment to a recipient.

```bash
x402 pay <recipient> <amount> [options]

# Examples
x402 pay 0x123...789 10.00              # Pay 10 USDs
x402 pay 0x123...789 5 --token USDC     # Pay 5 USDC
x402 pay 0x123...789 1 --gasless        # Gasless transfer
x402 pay 0x123...789 100 -y             # Skip confirmation
```

Options:
- `-t, --token <token>` - Token to send (USDs, USDC, USDT, DAI)
- `-g, --gasless` - Use gasless transfer (EIP-3009)
- `-m, --memo <memo>` - Payment note
- `-y, --yes` - Skip confirmation prompt

### `x402 balance`

Check token balances.

```bash
x402 balance                    # Your wallet
x402 balance 0x123...789        # Specific address
x402 balance --token USDs       # Specific token
```

### `x402 yield`

View USDs auto-yield information.

```bash
x402 yield                      # Your wallet
x402 yield 0x123...789          # Specific address
```

### `x402 tools`

Manage X402 tools.

```bash
# List registered tools
x402 tools list

# Call a tool
x402 tools call <tool-name> --args '{"key": "value"}'

# Register a new tool
x402 tools register my_tool 0.10 --description "My tool"
```

### `x402 history`

View payment history.

```bash
x402 history                    # Last 10 transactions
x402 history --limit 25         # Last 25 transactions
x402 history --type payment     # Filter by type
x402 history --status confirmed # Filter by status
```

### `x402 tx`

View transaction details.

```bash
x402 tx <hash>                  # View transaction
x402 tx <hash> --refresh        # Refresh status from chain
```

### `x402 config`

Manage configuration.

```bash
x402 config list                        # Show all config
x402 config get <key>                   # Get value
x402 config set network arbitrum-sepolia # Set value
x402 config reset                       # Reset to defaults
```

Configuration keys:
- `network` - arbitrum, arbitrum-sepolia
- `defaultToken` - USDs, USDC, USDT, DAI
- `rpcUrl` - Custom RPC URL
- `facilitatorUrl` - Facilitator service URL
- `gaslessEnabled` - true/false
- `autoApproveUnder` - Auto-approve payments under this amount

## Example Session

```bash
$ x402 init
██╗  ██╗██╗  ██╗ ██████╗ ██████╗ 
╚██╗██╔╝██║  ██║██╔═████╗╚════██╗
 ╚███╔╝ ███████║██║██╔██║ █████╔╝
 ██╔██╗ ╚════██║████╔╝██║██╔═══╝ 
██╔╝ ██╗     ██║╚██████╔╝███████╗
╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
  Payment Protocol for AI Agents

Setting up your X402 payment CLI...

? Enter your private key: ********
? Select network: 🌐 Arbitrum Mainnet
? Enable gasless transactions (EIP-3009)? Yes
? Auto-approve payments under (USD, empty to disable): 1

✓ Credentials stored
✓ Configuration created at ~/.x402/config.json
✓ Connected to Arbitrum Mainnet

ℹ Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
ℹ Network: Arbitrum Mainnet
ℹ USDs Balance: 1,234.56 USDs

✓ X402 CLI is ready to use!

$ x402 balance
✓ Balances retrieved
╭──────────────────────────╮
│      Wallet Balance      │
├──────────────────────────┤
│ 💰 USDs: 1,234.56 USDs   │
│ 🪙 USDC: 50.00 USDC      │
│                          │
│ 🌐 Network: Arbitrum     │
╰──────────────────────────╯

$ x402 yield
✓ Yield information retrieved
╭──────────────────────────────────╮
│         USDs Auto-Yield          │
├──────────────────────────────────┤
│ 💰 USDs Balance: 1,234.56 USDs   │
│ 📈 Yield Earned: +12.34 USDs     │
│ 📊 Current APY: 4.5%             │
│ 📅 Monthly: ~4.63 USDs           │
│ 🔄 Last Rebase: 1/22/2026, 10:00 │
╰──────────────────────────────────╯

ℹ️  USDs is an auto-rebasing stablecoin. Your balance increases
   automatically as yield is earned - no claiming required!

$ x402 pay 0x1234...5678 10.00
✓ Balance: 1,234.56 USDs
╭─────────────────────────────╮
│      Confirm Payment        │
├─────────────────────────────┤
│ 📤 To: 0x1234...5678        │
│ 💰 Amount: 10.00 USDs       │
│ 🌐 Network: Arbitrum        │
│ ⛽ Gasless: Enabled         │
╰─────────────────────────────╯

? Confirm payment? Yes
✓ Payment confirmed!

╭─────────────────────────────────────────────────╮
│             Transaction Details                 │
├─────────────────────────────────────────────────┤
│ 📋 Hash: 0xabc...def                            │
│ 📦 Type: payment                                │
│ 💰 Amount: 10.00 USDs                           │
│ 📤 Recipient: 0x1234...5678                     │
│ ✅ Status: confirmed                            │
│ 🌐 Network: arbitrum                            │
│ 📅 Date: 1/22/2026, 10:30:00 AM                 │
╰─────────────────────────────────────────────────╯

Explorer: https://arbiscan.io/tx/0xabc...def
```

## Configuration

Configuration is stored in `~/.x402/config.json`:

```json
{
  "network": "arbitrum",
  "walletAddress": "0x...",
  "defaultToken": "USDs",
  "facilitatorUrl": "http://localhost:3002",
  "gaslessEnabled": true,
  "autoApproveUnder": "1",
  "lastUsed": 1737561600000
}
```

Transaction history is stored in `~/.x402/history.json`.

## Environment Variables

- `X402_PRIVATE_KEY` - Private key (overrides stored key)
- `X402_NETWORK` - Network override
- `X402_RPC_URL` - Custom RPC URL
- `X402_VERBOSE` - Enable verbose logging

## Supported Tokens

| Token | Description | Network |
|-------|-------------|---------|
| USDs | Sperax USD - Auto-yield stablecoin | Arbitrum |
| USDC | USD Coin | Arbitrum |
| USDT | Tether USD | Arbitrum |
| DAI | Dai Stablecoin | Arbitrum |

## Supported Networks

| Network | Chain ID | Description |
|---------|----------|-------------|
| arbitrum | 42161 | Arbitrum One Mainnet |
| arbitrum-sepolia | 421614 | Arbitrum Sepolia Testnet |

## Security Notes

- Private keys are stored securely using environment variables
- For production use, consider using a hardware wallet or keytar for OS keychain integration
- Never share your private key or commit it to version control
- Use testnet (arbitrum-sepolia) for testing

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev -- balance

# Build
npm run build

# Link globally for testing
npm link

# Run tests
npm test
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Related

- [X402 Protocol](../x402/README.md) - Core payment protocol
- [Sperax USDs](https://sperax.io/) - Auto-yield stablecoin
- [Arbitrum](https://arbitrum.io/) - Layer 2 scaling solution
