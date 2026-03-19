# Coinbase CDP x402 Demo

This example demonstrates how to use the x402 payment protocol with Coinbase Developer Platform (CDP) wallets for secure, managed transaction signing.

## Features

- **Managed Wallets**: Uses CDP for secure wallet management (no local private keys)
- **Multi-Chain Support**: Works with Base, Ethereum, Polygon, and their testnets
- **Server & Client**: Complete example of both payment provider and consumer
- **Environment Variables**: Secure credential management via `.env` file

## Prerequisites

1. **Coinbase Developer Platform Account**
   - Sign up at https://portal.cdp.coinbase.com/
   - Create an API key and download the credentials

2. **Go 1.21+**
   ```bash
   go version
   ```

3. **USDC Balance** (for testnet testing)
   - Get testnet USDC from faucets for Base Sepolia or Ethereum Sepolia

## Setup

1. **Clone and Build**
   ```bash
   cd examples/coinbase
   go build -o coinbase-demo .
   ```

2. **Configure Credentials**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your CDP credentials:
   ```bash
   CDP_API_KEY_NAME=organizations/your-org-id/apiKeys/your-key-id
   CDP_API_KEY_SECRET=hM...Few==
   CDP_WALLET_SECRET=  # Optional, leave empty if not needed
   ```

   **Note**: The `CDP_API_KEY_SECRET` is a base64-encoded DER/PKCS8 private key (looks like `hM...Few==`) from the `privateKey` field in your CDP API key JSON file.

## Usage

### Run the Server

Start a server that requires x402 payments:

```bash
# Using Base testnet (default)
./coinbase-demo server --pay-to 0xYourAddress

# Using Ethereum testnet
./coinbase-demo server --pay-to 0xYourAddress --network ethereum-sepolia

# Custom port and payment amount
./coinbase-demo server --pay-to 0xYourAddress --port 8081 --amount 5000
```

Server flags:
- `--port` - Server port (default: 8080)
- `--network` - Network to accept payments on (default: base-sepolia)
- `--pay-to` - Address to receive payments (required)
- `--token` - Token address (auto-detected from network)
- `--amount` - Payment amount in atomic units (default: 1000 = 0.001 USDC)
- `--facilitator` - Facilitator URL (default: https://facilitator.x402.rs)
- `--verbose` - Enable debug output

### Run the Client

Make requests to paywalled endpoints:

```bash
# Using environment variables from .env
./coinbase-demo client --url http://localhost:8080/data --network base-sepolia

# Using command-line flags
./coinbase-demo client \
  --url http://localhost:8080/data \
  --network base-sepolia \
  --api-key-name "organizations/your-org/apiKeys/your-key" \
  --api-key-secret "hM...Few==" \
  --verbose
```

Client flags:
- `--url` - URL to fetch (required)
- `--network` - Network to use (default: base-sepolia)
- `--api-key-name` - CDP API Key Name (or set `CDP_API_KEY_NAME` env var)
- `--api-key-secret` - CDP API Key Secret (or set `CDP_API_KEY_SECRET` env var)
- `--wallet-secret` - CDP Wallet Secret (optional, or set `CDP_WALLET_SECRET` env var)
- `--token` - Token address (auto-detected from network)
- `--max-amount` - Maximum amount per call (optional)
- `--verbose` - Enable debug output

### Server Endpoints

- `GET /` - Server information
- `GET /data` - Paywalled endpoint (requires x402 payment)
- `GET /public` - Free public endpoint (no payment required)

## Supported Networks

**EVM Networks:**
- `base` - Base Mainnet
- `base-sepolia` - Base Testnet
- `ethereum` - Ethereum Mainnet
- `ethereum-sepolia` - Ethereum Testnet (Sepolia)
- `polygon` - Polygon Mainnet

**Default Token Addresses:**
- Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC)
- Ethereum: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (USDC)
- Polygon: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (USDC)

## Example Workflow

1. **Start the server** (in one terminal):
   ```bash
   ./coinbase-demo server --pay-to 0xYourRecipientAddress
   ```

2. **Run the client** (in another terminal):
   ```bash
   ./coinbase-demo client --url http://localhost:8080/data --verbose
   ```

3. **Expected Output**:
   ```
   Initializing Coinbase CDP signer...
   Created Coinbase CDP signer for address: 0xYourCDPAddress
   Network: base-sepolia
   Token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

   Fetching: http://localhost:8080/data

   ✓ Payment successful!
     Transaction: 0x123abc...
     Network: base-sepolia
     Payer: 0xYourCDPAddress

   Response Status: 200 OK
   Content-Type: application/json

   Response Body:
   {"message":"Successfully accessed paywalled content!","timestamp":"2024-01-15T10:30:00Z","data":{"premium":true,"secret":"This is premium data that requires payment via Coinbase CDP"}}
   ```

## Security Notes

1. **Never commit `.env` files** - Add `.env` to `.gitignore`
2. **Protect API credentials** - Treat CDP API keys like passwords
3. **Use testnet first** - Test with testnet USDC before using mainnet
4. **Monitor spending** - Set appropriate `--max` limits for production

## Troubleshooting

**"CDP credentials not provided"**
- Ensure `.env` file exists and contains valid credentials
- Check that environment variables are properly loaded

**"Failed to create or get account"**
- Verify CDP API credentials are correct
- Check network connectivity to CDP API
- Ensure your CDP account has necessary permissions

**"Insufficient balance"**
- Check your CDP wallet has enough USDC for payments
- For testnets, get free USDC from faucets

**"Invalid network"**
- Verify network name matches supported networks
- Check network is supported by CDP

## Resources

- [x402 Protocol Documentation](https://github.com/mark3labs/x402-go)
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
- [CDP API Documentation](https://docs.cdp.coinbase.com/)

## Differences from http example

This example uses **Coinbase CDP** for wallet management, while the `http` example uses local private keys:

| Feature | coinbase-demo | http |
|---------|---------------|----------|
| Wallet Management | CDP Managed | Local Private Keys |
| Key Storage | Remote (CDP) | Local Keystore |
| Setup | API Key Required | Private Key Required |
| Security | Enterprise-grade | Self-managed |
| Chains | EVM Only (CDP limitation) | EVM + Solana |

For Solana support, use the `http` example instead.
