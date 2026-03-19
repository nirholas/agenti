# caddy-x402

A [Caddy](https://caddyserver.com/) middleware that charges AI crawlers real money (USDC stablecoin) to access your website content, using the [x402 protocol](https://github.com/coinbase/x402) by Coinbase.

## The problem

AI companies send crawlers (GPTBot, ClaudeBot, etc.) to scrape your website and use your content to train their models or power their products. You get nothing. `robots.txt` is a suggestion they can ignore. This plugin makes them pay.

## How the money flows

```
AI Crawler (GPTBot, ClaudeBot, etc.)
    |
    |  1. Crawls your page
    v
Your Caddy Server (this plugin)
    |
    |  2. Returns HTTP 402 "Pay me $0.01 in USDC to see this"
    v
AI Crawler
    |
    |  3. Signs a USDC payment authorization (EIP-3009)
    |     and sends it in the X-PAYMENT header
    v
Your Caddy Server
    |
    |  4. Forwards the signed payment to the Facilitator
    v
x402 Facilitator (x402.org, run by Coinbase)
    |
    |  5. Verifies the signature is valid
    |  6. Submits the transaction on-chain (Base L2)
    |  7. USDC moves from crawler's wallet -> your wallet
    v
Your Caddy Server
    |
    |  8. Confirms payment, serves the content
    v
AI Crawler gets the page content
```

**You receive USDC (a dollar-pegged stablecoin) directly in your wallet.** No middlemen hold your money. The facilitator just relays the transaction to the blockchain — the payment goes straight from the crawler's wallet to yours.

## What you need

1. **An EVM wallet address** to receive payments. This is a standard Ethereum/Base wallet address (starts with `0x`). You can create one with:
   - [Coinbase Wallet](https://www.coinbase.com/wallet)
   - [MetaMask](https://metamask.io/)
   - Any wallet that supports Base network

2. **A server running Caddy** (your web server)

3. **xcaddy** to build Caddy with this plugin: `go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest`

That's it. No API keys needed for the default facilitator. No crypto knowledge required beyond having a wallet address.

## Quick start

### 1. Build Caddy with the plugin

```bash
xcaddy build --with github.com/paolobietolini/caddy-x402
```

This produces a `caddy` binary with the x402 middleware baked in.

### 2. Configure your Caddyfile

```caddyfile
yoursite.com {
    x402 {
        pay_to    0xYOUR_WALLET_ADDRESS
        price     0.01
        network   base

        # Don't block these paths (crawlers need robots.txt, search engines need favicons)
        exempt /robots.txt
        exempt /favicon.ico
        exempt /.well-known/*
    }

    # Your normal site config below
    reverse_proxy localhost:3000
    # or: file_server, php_fastcgi, etc.
}
```

### 3. Replace your current Caddy binary and restart

```bash
sudo systemctl stop caddy
sudo cp caddy /usr/bin/caddy
sudo chmod +x /usr/bin/caddy
sudo systemctl start caddy
```

### 4. Verify it works

```bash
# Normal browser request — should get your page normally
curl https://yoursite.com/

# AI crawler request — should get 402 Payment Required
curl -A "GPTBot/1.0" https://yoursite.com/
```

The 402 response looks like:

```json
{
  "x402Version": 1,
  "error": "Payment required to access this resource",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "10000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0xYOUR_WALLET_ADDRESS",
    "resource": "https://yoursite.com/your-page",
    "maxTimeoutSeconds": 60,
    "extra": {"name": "USDC", "version": "2"}
  }]
}
```

## How to get paid

Once the plugin is running, payments happen automatically:

1. An AI crawler hits your site
2. It gets a 402 response telling it the price and your wallet
3. If the crawler supports x402 (and has funds), it signs a payment and retries
4. The payment is settled on Base (an Ethereum L2 — fast and cheap)
5. **USDC appears in your wallet**

To check your balance, look up your wallet address on [basescan.org](https://basescan.org). The USDC will show under the "Token" tab.

To convert USDC to real money in your bank, you can:
- Transfer USDC to Coinbase, sell for EUR/USD, withdraw to your bank
- Use any exchange that supports USDC on Base

### Which crawlers support x402?

As of early 2025, x402 is new. Crawlers that support it will pay automatically. Crawlers that don't will simply get a 402 error and not see your content — which is the point. You're blocking them unless they pay.

The plugin detects these crawlers (and more):

| Company | Crawler |
|---|---|
| OpenAI | GPTBot, ChatGPT-User, OAI-SearchBot |
| Google | Google-Extended, Googlebot-Extended |
| Anthropic | ClaudeBot, Claude-Web, anthropic-ai |
| Meta | FacebookBot, Meta-ExternalAgent |
| Perplexity | PerplexityBot |
| Amazon | Amazonbot |
| Bytedance | Bytespider |
| Common Crawl | CCBot |

Normal users (browsers, curl, etc.) are never affected.

## Testing on testnet first

If you want to test without real money, use `base-sepolia` (the test network):

```caddyfile
yoursite.com {
    x402 {
        pay_to    0xYOUR_WALLET_ADDRESS
        price     0.01
        network   base-sepolia
    }
}
```

You can get free testnet USDC from Coinbase's [faucet](https://portal.cdp.coinbase.com/products/faucet).

### Dry run mode

To see what would happen without any blockchain interaction:

```caddyfile
x402 {
    pay_to    0xYOUR_WALLET_ADDRESS
    price     0.01
    network   base
    dry_run   true
}
```

This logs everything but skips payment verification. Crawlers that send an `X-PAYMENT` header will get through as if they paid.

## Configuration reference

```caddyfile
x402 {
    pay_to              0xADDRESS           # (required) Your EVM wallet address
    price               0.01                # (required) Price in USDC per request
    network             base                # Blockchain: "base" (mainnet) or "base-sepolia" (testnet)

    facilitator_url     https://x402.org/facilitator   # Payment processor endpoint
    facilitator_key     {env.CDP_API_KEY}              # API key (if using a private facilitator)

    exempt              /robots.txt         # Path to skip (repeatable)
    exempt              /favicon.ico
    exempt              /.well-known/*

    cloudflare_compat   true                # Emit crawler-price/crawler-charged headers
    db_path             /var/lib/caddy/x402-payments.db   # SQLite audit log
    dry_run             false               # Skip real payments (testing)
    description         "My site content"   # Description shown in 402 response
    max_timeout         60                  # Max payment timeout in seconds
    crawler_pattern     MyCustomBot         # Extra regex pattern to match (repeatable)
}
```

### Exempt path patterns

- Exact match: `exempt /robots.txt`
- Wildcard (prefix): `exempt /.well-known/*` matches `/.well-known/anything/nested`
- Glob: `exempt /static/*.css`

### Audit trail

Every payment attempt (successful or not) is logged to a SQLite database. You can query it:

```bash
sqlite3 /var/lib/caddy/x402-payments.db "SELECT timestamp, path, crawler_name, payer, amount, success, tx_hash FROM payments ORDER BY timestamp DESC LIMIT 20"
```

## Pricing strategy

The `price` is per request in USDC. Some examples:

| Price | What it means |
|---|---|
| `0.001` | $0.001 per page — cheap, mostly symbolic |
| `0.01` | $0.01 per page — reasonable for blog posts |
| `0.10` | $0.10 per page — premium content |
| `1.00` | $1.00 per page — high-value data |

A crawler scraping 1,000 pages at $0.01 each = $10. At $0.10 each = $100.

## Deployment

### Using the Makefile

```bash
# Build
make build

# Run tests
make test

# Deploy to your server (set environment variables)
DEPLOY_HOST=user@yourserver.com DEPLOY_KEY=~/.ssh/your_key make deploy
```

### Manual deployment

```bash
# Build locally
xcaddy build --with github.com/paolobietolini/caddy-x402=./ --output ./caddy-x402

# Copy to server
scp ./caddy-x402 user@server:/tmp/caddy-x402

# On the server
sudo systemctl stop caddy
sudo cp /usr/bin/caddy /usr/bin/caddy.backup
sudo cp /tmp/caddy-x402 /usr/bin/caddy
sudo chmod +x /usr/bin/caddy
sudo systemctl start caddy
```

## Development

```bash
# Run tests
go test ./... -v

# Run tests with race detector
go test ./... -race

# Format code
go fmt ./...
```

## How x402 works (the protocol)

[x402](https://github.com/coinbase/x402) is an open protocol by Coinbase that gives meaning to HTTP status code 402 ("Payment Required"). It works like this:

1. **Server returns 402** with a JSON body describing what payment it accepts (amount, currency, wallet address, network)
2. **Client signs a payment** using [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) `TransferWithAuthorization` — this authorizes a USDC transfer without actually executing it yet
3. **Client retries the request** with the signed payment in the `X-PAYMENT` header (base64-encoded)
4. **Server forwards to a facilitator** (x402.org) which verifies the signature and submits the on-chain transaction
5. **USDC moves on-chain** from the client's wallet to the server's wallet
6. **Server serves the content** and includes an `X-PAYMENT-RESPONSE` header with the transaction hash

The payment happens on [Base](https://base.org/), an Ethereum L2 built by Coinbase. Transaction fees are fractions of a cent.

## License

BSD-3-Clause
