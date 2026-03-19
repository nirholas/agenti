# ZeroPay

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://hub.docker.com/r/zeropaydev/zeropay)
[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org)

An open-source, self-hosted payment gateway for stablecoins and cryptocurrency payments.

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Platform](#managed-platform) • [Contributing](#contributing)

</div>

---

## Overview

ZeroPay is a lightweight, self-hosted payment gateway that enables merchants to accept stablecoin and cryptocurrency payments with minimal setup. Built with Rust for performance and reliability, it supports multiple EVM-compatible blockchains and provides real-time webhook notifications for payment events.

**New in v1.x:** ZeroPay now supports the **x402 Agent-to-Agent (A2A) payment protocol**, enabling AI agents and autonomous systems to programmatically discover, authorize, and settle payments using EIP-3009 gasless transfers.

### Key Features

- **Self-Hosted**: Full control over your payment infrastructure
- **Multi-Chain Support**: Compatible with Ethereum, Polygon, BSC, and other EVM chains
- **Stablecoin Focused**: Built for USDT, USDC, and other stablecoins
- **Real-Time Notifications**: Webhook integration for payment events
- **Automatic Settlement**: Funds automatically transferred to your wallet (minus commission)
- **x402 Protocol Support**: Agent-to-Agent (A2A) payment protocol for AI-powered integrations
- **Secure**: HMAC-based webhook authentication and EIP-712 signatures
- **Easy Integration**: RESTful API with comprehensive documentation
- **Docker Ready**: One-command deployment with Docker

## Quick Start

### Using Docker Compose (Recommended)

The easiest way to run ZeroPay with all dependencies:

1. **Configure your settings:**

   Edit `docker-compose.yml` environment variables:
   ```yaml
   environment:
     - MNEMONICS=your twelve or twenty four word mnemonic phrase
     - WALLET=0xYourWalletAddress
     - APIKEY=your-secure-api-key
     - WEBHOOK=https://your-webhook-url.com
   ```

2. **Configure blockchain:**

   Edit `config.toml` with your chain settings (RPC URL, tokens, etc.)

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Check logs:**
   ```bash
   docker-compose logs -f zeropay
   ```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup instructions.

## Documentation

- **[Deployment Guide](./DEPLOYMENT.md)** - Complete setup instructions for Docker and source builds
- **[API Reference](./API.md)** - REST API endpoints, webhook events, and usage examples
- **[x402 Protocol Integration](./x402.md)** - Agent-to-Agent (A2A) payment protocol integration guide
- **[AI Integration Guide](./docs/AI_INTEGRATION_GUIDE.md)** - Prompt and guide for AI agents to integrate with ZeroPay API
- **[Configuration Guide](#configuration)** - Environment and chain configuration

## Managed Platform

For a hassle-free experience, use our managed platform at [zpaynow.com](https://zpaynow.com):

**Benefits:**
- No infrastructure management required
- Automatic updates and security patches
- Public payment UI for customers
- Multiple chain support out of the box
- Enterprise-grade reliability

**Setup:**
1. Register your merchant account at [zpaynow.com](https://zpaynow.com)
2. Use `https://api.zpaynow.com` as your API endpoint
3. Start accepting payments immediately

**Note:** The platform charges a small commission for gas fees and hosting.

## Architecture

```
┌─────────────┐         ┌─────────────┐
│   Client    │         │  AI Agent   │
│ Application │         │  (x402)     │
└──────┬──────┘         └──────┬──────┘
       │ REST API              │ x402 Protocol
       │                       │ (EIP-3009)
       ▼                       ▼
┌──────────────────────────────────┐
│         ZeroPay API              │
│  /sessions     /x402/*           │◄──────┐
└──────┬───────────────────────────┘       │
       │                                   │
       ├───────────────────────────────────┤
       │                                   │
       ▼                                   ▼
┌──────────┐                        ┌──────────┐
│PostgreSQL│                        │  Redis   │
└──────────┘                        └──────────┘
       │
       │ Scanner + x402 Facilitator
       ▼
┌─────────────────────────────────────┐
│         Blockchain                  │
│  (Ethereum, Polygon, Base, etc)     │
│  EIP-3009 transferWithAuthorization │
└─────────────────────────────────────┘
```

## Development

### Prerequisites

- Rust 1.75 or higher
- PostgreSQL 12+
- Redis 6+

### Build from Source

```bash
# Clone the repository
git clone https://github.com/ZeroPayDev/zeropay.git
cd zeropay

# Build
cargo build --release

# Run
./target/release/api
```

### Project Structure

```
zeropay/
├── api/              # REST API server
├── scanner/          # Blockchain scanner
├── config.toml       # Chain configuration
├── Dockerfile        # Container build file
└── .env-template     # Environment template
```

## Contributing

We welcome contributions!

### Reporting Vulnerabilities

If you discover a security vulnerability, please email hi@zpaynow.com instead of using the issue tracker.

### Best Practices

- Never commit `.env` files or private keys
- Use strong, randomly generated API keys
- Verify webhook HMAC signatures
- Keep dependencies updated
- Use secure RPC endpoints
- Enable firewall rules

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
