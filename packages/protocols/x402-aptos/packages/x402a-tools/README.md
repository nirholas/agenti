# @x402a/tools

Command-line tools for managing x402a infrastructure on Aptos blockchain.

## Installation

```bash
# From monorepo root
bun install

# Build the tools
cd packages/x402a-tools
bun run build
```

## Usage

### Facilitator Commands

#### Generate a New Facilitator Account
```bash
bun x402a facilitator:generate
```

Creates a new Aptos account for processing payments. The private key will be displayed - save it securely!

#### Check Facilitator Balance
```bash
bun x402a facilitator:balance
```

Checks the current balance of your facilitator account.

**Requires:**
- `FACILITATOR_PRIVATE_KEY` environment variable

#### Fund Facilitator Account
```bash
bun x402a facilitator:fund
```

Requests testnet APT from the Aptos faucet for your facilitator account.

**Requires:**
- `FACILITATOR_PRIVATE_KEY` environment variable

#### Verify Facilitator Configuration
```bash
bun x402a facilitator:verify
```

Verifies that your private key matches the configured facilitator address.

**Requires:**
- `FACILITATOR_PRIVATE_KEY` environment variable
- `NEXT_PUBLIC_FACILITATOR_ADDRESS` environment variable

### Registry Commands

#### Initialize Nonce Registry
```bash
bun x402a registry:init
```

Initializes the on-chain nonce registry for the facilitator. This must be done once before processing payments.

**Requires:**
- `FACILITATOR_PRIVATE_KEY` environment variable
- `NEXT_PUBLIC_CONTRACT_ADDRESS` environment variable

### Account Commands

#### Check Both Accounts
```bash
bun x402a account:check
```

Checks balances for both your wallet and facilitator accounts.

**Optional Environment Variables:**
- `WALLET_ADDRESS` - Your wallet address
- `NEXT_PUBLIC_FACILITATOR_ADDRESS` - Facilitator address

## Environment Variables

Create a `.env.local` file in your project root:

```bash
# Facilitator Configuration
FACILITATOR_PRIVATE_KEY=0x...
NEXT_PUBLIC_FACILITATOR_ADDRESS=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Optional: Your wallet address for balance checks
WALLET_ADDRESS=0x...
```

## Getting Started

1. **Generate a facilitator account:**
   ```bash
   bun x402a facilitator:generate
   ```

2. **Save the private key to `.env.local`**

3. **Fund the account:**
   ```bash
   bun x402a facilitator:fund
   ```

4. **Initialize the registry:**
   ```bash
   bun x402a registry:init
   ```

5. **Verify everything is working:**
   ```bash
   bun x402a facilitator:verify
   bun x402a account:check
   ```

## Development

```bash
# Build the CLI
bun run build

# Watch mode during development
bun run dev

# Type checking
bun run typecheck
```

## Security Notes

- **NEVER** commit your `FACILITATOR_PRIVATE_KEY` to version control
- Store private keys in `.env.local` (already in `.gitignore`)
- The facilitator account holds funds to pay for gas fees
- Rotate keys regularly for production use

## License

MIT
