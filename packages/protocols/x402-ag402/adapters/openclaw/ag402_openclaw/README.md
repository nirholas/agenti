# ag402 OpenClaw Bridge

HTTP proxy bridge with automatic x402 payment for OpenClaw agents.

## Description

The bridge intercepts outbound HTTP requests, detects 402 Payment Required responses, automatically pays via Solana USDC, and returns the paid response to the calling agent.

## Architecture

```
OpenClaw Agent → mcporter → ag402-openclaw (bridge) → Paid API
```

## Features

### Security

| Feature | Description |
|---------|-------------|
| SSRF Protection | Blocks localhost, private IPs, dangerous ports |
| API Key Auth | AG402_API_KEY environment variable |
| Payment Confirm | $10 threshold for large payments |
| Budget Limits | Configurable daily/single/per-minute limits |

### Integration

- **mcporter**: Recommended integration method
- **Direct**: Python module import

## Installation

```bash
# Via mcporter (recommended)
mcporter config add ag402 --command python -m ag402_openclaw.bridge --scope home
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| AG402_API_KEY | API key for authentication | (none) |
| AG402_BRIDGE_MODE | test or production | test |
| AG402_DAILY_LIMIT | Daily spend limit (USD) | 100.0 |
| AG402_SINGLE_TX_LIMIT | Single transaction limit | 50.0 |
| AG402_PER_MINUTE_LIMIT | Per-minute limit | 20.0 |
| AG402_CONFIRM_PAYMENT | Require confirmation | false |

## Usage

### As mcporter service

```bash
# Add to mcporter
mcporter config add ag402 --command python -m ag402_openclaw.bridge

# Use in agent
curl -X POST http://localhost:14022/proxy -H "Content-Type: application/json" \
  -d '{"url": "https://api.example.com/data", "method": "GET"}'
```

### Direct Python import

```python
from ag402_openclaw import OpenClawBridge

bridge = OpenClawBridge()
result = await bridge.proxy_request(
    url="https://api.example.com/data",
    method="GET"
)
```

## API

### POST /proxy

```json
{
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {"Authorization": "Bearer token"},
  "body": "request body",
  "max_amount": 10.0
}
```

### Response

```json
{
  "status_code": 200,
  "body": "response data",
  "headers": {},
  "payment_made": true,
  "amount_paid": 1.5,
  "tx_hash": "..."
}
```

## Health Check

```bash
curl http://localhost:14022/health
```

## Version

v0.1.10 - 2026-03-06
