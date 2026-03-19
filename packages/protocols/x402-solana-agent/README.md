# Solana AI Agent 
 
 Solana AI agent - Swap tokens, manage wallets, transfer funds, and stake SOL — all without human intervention.
Which is integrated with x402 payments.

**Solana AI Agent** gives agents economic agency:
- Create and manage wallets
- Swap tokens via Jupiter aggregator
- Transfer SOL and SPL tokens
- Stake SOL to validators
- Check balances and prices
- Portfolio tracking via AgentDEX

## Installation

### NPM Package

```bash
npm install solana-agent-kit
```

### Local Development

```bash
git clone https://github.com/roswelly/solana-ai-agent
cd solana-agent-kit
npm install
npm link
```

## Quick Start

### 1. Create a Wallet

```bash
solana-agent wallet create
```

This creates a new wallet and saves it to `~/.config/solana/id.json` (or path specified in `SOLANA_WALLET_PATH`).

### 2. Check Balance

```bash
solana-agent wallet balance
```

### 3. Swap Tokens

```bash
solana-agent swap quote SOL USDC 1000000000

solana-agent swap execute SOL USDC 1000000000
```

## CLI Usage

The CLI is designed for agents to shell out to. All commands output JSON for easy parsing.

### Wallet Commands

```bash
solana-agent wallet create [path]

solana-agent wallet balance

solana-agent wallet tokens

solana-agent wallet address
```

### Swap Commands

```bash
solana-agent swap quote SOL USDC 1000000000

solana-agent swap execute SOL USDC 1000000000

solana-agent price SOL
```

### Transfer Commands

```bash
solana-agent transfer <recipient> 0.1

solana-agent transfer <recipient> 1000000 --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Staking Commands

```bash
solana-agent stake delegate jito 1.0

solana-agent stake list

solana-agent stake unstake <stake_account_address>

solana-agent stake withdraw <stake_account_address>

solana-agent stake validators
```

### Utility Commands

```bash
solana-agent tokens
```

## Library Usage

Use the library directly in your Node.js code:

```javascript
const { Wallet, Swapper, Transfer, Staking } = require('solana-agent-kit');

const wallet = Wallet.fromFile('~/.config/solana/id.json');

const newWallet = Wallet.create();
newWallet.save('./my-wallet.json');

const balance = await wallet.getBalance();
console.log(`Balance: ${balance} SOL`);

const tokens = await wallet.getAllTokenBalances();

const swapper = new Swapper(wallet);

const quote = await swapper.getQuote('SOL', 'USDC', 1000000000);
console.log(`Would receive: ${quote.outAmount} USDC`);

const result = await swapper.swap('SOL', 'USDC', 1000000000);
console.log(`Swapped! TX: ${result.signature}`);

const transfer = new Transfer(wallet);
await transfer.sendSol('recipient...', 0.1);

await transfer.sendToken('recipient...', 1000000, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const staking = new Staking(wallet);
await staking.stake('jito', 1.0);

const accounts = await staking.getStakeAccounts();
```

## HTTP Server

For agents that can't shell out, use the HTTP server:

```bash
solana-agent-server

solana-agent-server 8080
```

### API Endpoints

#### Wallet

- `GET /health` - Health check
- `GET /wallet/address` - Get wallet address
- `GET /wallet/balance` - Get SOL balance
- `GET /wallet/tokens` - Get all token balances

#### Swap

- `POST /swap/quote` - Get swap quote
  ```json
  {
    "from": "SOL",
    "to": "USDC",
    "amount": "1000000000",
    "slippage": 50
  }
  ```

- `POST /swap/execute` - Execute swap
  ```json
  {
    "from": "SOL",
    "to": "USDC",
    "amount": "1000000000",
    "slippage": 50
  }
  ```

- `GET /price?token=SOL` - Get token price

#### Transfer

- `POST /transfer/sol` - Send SOL
  ```json
  {
    "to": "recipient_address",
    "amount": 0.1
  }
  ```

- `POST /transfer/token` - Send SPL token
  ```json
  {
    "to": "recipient_address",
    "amount": "1000000",
    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
  ```

#### Staking

- `POST /stake/delegate` - Stake SOL
  ```json
  {
    "validator": "jito",
    "amount": 1.0
  }
  ```

- `GET /stake/list` - List stake accounts
- `POST /stake/unstake` - Start unstaking
  ```json
  {
    "stakeAccount": "stake_account_address"
  }
  ```

- `POST /stake/withdraw` - Withdraw unstaked SOL
  ```json
  {
    "stakeAccount": "stake_account_address"
  }
  ```

#### Utilities

- `GET /tokens` - List known token symbols
- `GET /validators` - List known validators

## Supported Tokens

Built-in token symbols:
- `SOL` - Native Solana
- `USDC` - USD Coin
- `USDT` - Tether
- `BONK` - Bonk
- `JUP` - Jupiter
- `WIF` - dogwifhat
- `PYTH` - Pyth Network

You can also use any token by its mint address.

## Supported Validators

Pre-configured validators:
- `jito` - Jito
- `marinade` - Marinade Finance
- `solflare` - Solflare
- `everstake` - Everstake

### Setup

```javascript
const { AgentDEXClient } = require('solana-agent-kit');

const dex = new AgentDEXClient({
  apiKey: 'adx_your_api_key',        
});
```

### Get a Quote

```javascript
const quote = await dex.getQuote(
  'So11111111111111111111111111111111111111112',  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  1_000_000_000, // 1 SOL in lamports
  50,            // 0.5% slippage (basis points)
);
console.log(`Expected output: ${quote.outAmount} USDC`);
```

### Execute a Swap

```javascript
const result = await dex.swap(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  1_000_000_000,
);
console.log(`TX: ${result.signature}`);
```

### Portfolio Tracking

```javascript
const portfolio = await dex.getPortfolio('YourWalletPublicKey...');
console.log(`Total value: $${portfolio.totalUsdValue}`);
for (const token of portfolio.tokens) {
  console.log(`  ${token.symbol}: ${token.balance} ($${token.usdValue})`);
}
```

### Token Prices

```javascript
const allPrices = await dex.getPrices();

const [solPrice] = await dex.getPrices(['So11111111111111111111111111111111111111112']);
console.log(`SOL: $${solPrice.priceUsd}`);
```

### Limit Orders

```javascript
const order = await dex.createLimitOrder(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  1_000_000_000,
  180.50, // target price
);
console.log(`Order placed: ${order.id}`);

const orders = await dex.getLimitOrders();

await dex.cancelLimitOrder(order.id);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLANA_WALLET_PATH` | Path to wallet JSON file | `~/.config/solana/id.json` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `SOLANA_AGENT_PORT` | HTTP server port | `3030` |
| `AGENTDEX_API_KEY` | AgentDEX API key (`adx_xxx`) | - |
| `AGENTDEX_BASE_URL` | Custom AgentDEX API base URL | `https://api.agentdex.com` |

### Example `.env` file

```env
SOLANA_WALLET_PATH=./wallet.json
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_AGENT_PORT=3030
AGENTDEX_API_KEY=adx_your_api_key_here
```

## For AI Agents

This toolkit is designed to be agent-friendly:

1. **JSON output** - All CLI commands return parseable JSON
2. **Simple interface** - Common operations are one command
3. **Error handling** - Clear error messages with suggested fixes
4. **No interactivity** - Everything works non-interactively

### Example Agent Workflow

```bash

BALANCE=$(solana-agent wallet balance | jq -r '.balance')

if [ $(echo "$BALANCE > 1" | bc) -eq 1 ]; then
  solana-agent swap execute SOL USDC 500000000
fi
```

### Python Agent Example

```python
import subprocess
import json

def get_balance():
    result = subprocess.run(
        ['solana-agent', 'wallet', 'balance'],
        capture_output=True,
        text=True
    )
    data = json.loads(result.stdout)
    return data['balance']

def swap_tokens(from_token, to_token, amount):
    result = subprocess.run(
        ['solana-agent', 'swap', 'execute', from_token, to_token, str(amount)],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

balance = get_balance()
if balance > 1.0:
    result = swap_tokens('SOL', 'USDC', 500000000)
    print(f"Swapped! TX: {result['signature']}")
```

## Security

- Private keys are stored locally, never transmitted
- All transactions are signed locally
- No custodial risk — you control your keys
- Wallet files have secure permissions (600)

**Important Security Notes:**

- **Backup your wallet file!** Loss of the file means loss of funds.
- The HTTP server has **no authentication** by default. Only run it on trusted networks or add authentication.
- Never commit wallet files or private keys to version control.
- Use environment variables for sensitive configuration.

## Troubleshooting

### "Wallet not found" Error

```bash
# Create a wallet first
solana-agent wallet create
```

### "Insufficient funds" Error

- Check your balance: `solana-agent wallet balance`
- Ensure you have enough SOL for transaction fees (typically 0.000005 SOL per transaction)

### Swap Fails

- Check if the token pair is supported
- Verify you have enough balance
- Try increasing slippage tolerance (default is 0.5%)
- Check RPC endpoint is accessible

### RPC Rate Limiting

If you hit rate limits on the public RPC, use a dedicated RPC endpoint:

```bash
export SOLANA_RPC_URL=https://your-rpc-endpoint.com
```

### Transaction Confirmation Issues

- Transactions may take a few seconds to confirm
- Check transaction status on [Solscan](https://solscan.io)
- Ensure your RPC endpoint is responsive

## Development

### Project Structure

```
solana-agent-kit/
├── index.js              # Main entry point
├── src/
│   ├── cli.js            # CLI interface
│   ├── server.js         # HTTP server
│   ├── wallet.js         # Wallet management
│   ├── swap.js           # Token swapping
│   ├── transfer.js       # Transfers
│   ├── stake.js          # Staking
│   └── integrations/
│       └── agentdex.ts   # AgentDEX client
```

### Running Tests

```bash
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/roswelly/solana-ai-agent/issues)

## Keywords : **solana ai agent**, **agent automation**, **trading automation**
