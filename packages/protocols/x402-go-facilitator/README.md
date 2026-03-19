# x402-facilitator

**x402-facilitator** is a Go-based middleware that settles on-chain payments authorized via the [x402 protocol](https://x402.dev).

## Prerequisites
- Golang 1.24 or later
- Docker
- Docker Compose

## Support Schemes
| Scheme     | Status           | Description                   |
|------------|------------------|-------------------------------|
| EVM       | ✅ Supported      | Ethereum and EVM chains       |
| Solana    | 🚧 Planned        |                               |
| Sui       | 🚧 Planned        |                               |
| Tron      | 🚧 Planned        |                               |

## How to run

### Build binary
```bash
make build
```

### Run x402-facilitator

#### 1. Run with docker compose
```bash
docker compose up
```

#### 2. Configuration
x402-facilitator is configured via `config.toml`.
```
# Port for HTTP server (default: 9090)
port = 9090

# Blockchain access configuration
scheme = "evm"                   # Supported: "evm", "solana", "sui", "tron"
network = "base-sepolia"         # Network or chain name
url = "https://sepolia.base.org" # RPC endpoint or node URL
privateKey = ""                  # Private key for fee payer (hex string)
```

#### 3. Api Specification
After starting the service, open your browser to:
```
/swagger/index.html
```

### Run x402-client
```
Usage:
  x402-client [flags]

Flags:
  -A, --amount string    Amount to send
  -F, --from string      Sender address
  -h, --help             help for x402-client
  -n, --network string   Blockchain network to use (default "base-sepolia")
  -P, --privkey string   Sender private key
  -s, --scheme string    Scheme to use (default "evm")
  -T, --to string        Recipient address
  -t, --token string     token contract for sending (default "USDC")
  -u, --url string       Base URL of the facilitator server (default "http://localhost:9090")

Example:
  x402-client -n base-sepolia -s evm -t USDC -F {0xYourSenderAddress} -T {0xRecipientAddress} -P {YourPrivateKey} -A 1000
```


## Contributing
We welcome any contributions! Feel free to open issues or submit pull requests at any time.
