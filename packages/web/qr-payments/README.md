# Agenti 🚀

> **The Ultimate Cross-Chain Payment & Swap Platform**  
> A superior implementation of CrossFund - supporting 300+ chains, 1M+ tokens, and 55+ DEX protocols.

![Agenti](https://img.shields.io/badge/Agenti-Cross--Chain%20Payments-blue?style=for-the-badge)
![Chains](https://img.shields.io/badge/Chains-300+-silver?style=for-the-badge)
![Tokens](https://img.shields.io/badge/Tokens-1M+-black?style=for-the-badge)

---

## ✨ Features

### 🔄 Universal Swap Engine
- **Any Token → Any Token**: Swap across 300+ blockchains seamlessly
- **Optimal Routing**: Aggregates 55+ DEX protocols for best rates
- **Cross-Chain Bridges**: Automatic bridging when swapping across chains
- **Slippage Protection**: Configurable slippage with MEV protection
- **Gas Optimization**: Smart routing to minimize transaction costs

### 💳 Merchant Payment Processor
- **Accept Any Crypto**: Let customers pay with any token on any chain
- **Auto-Conversion**: Receive payments in your preferred currency
- **Invoice System**: Create and track payment invoices
- **Webhook Notifications**: Real-time payment confirmations
- **QR Code Payments**: Mobile-friendly payment flow

### 🔗 Multi-Chain Support
- **EVM Chains**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, and more
- **Layer 2s**: zkSync, Linea, Scroll, Mantle, Blast, Mode
- **Alt L1s**: Solana, Sui, Aptos, Near, Cosmos ecosystem
- **89+ Production Chains**: Full mainnet support

### 🎨 Modern UI/UX
- **Dark Theme**: Sleek black background with silver and blue accents
- **Responsive Design**: Works perfectly on desktop and mobile
- **Real-Time Updates**: Live price feeds and transaction tracking
- **Wallet Integration**: Connect with MetaMask, WalletConnect, Coinbase, and more

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- A Web3 wallet (MetaMask, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/nirholas/QR.git
cd QR

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── swap/          # Swap endpoints
│   │   ├── merchant/      # Merchant endpoints
│   │   ├── tokens/        # Token list endpoints
│   │   └── webhooks/      # Webhook handlers
│   ├── merchant/          # Merchant dashboard pages
│   ├── page.tsx           # Main swap interface
│   ├── layout.tsx         # Root layout
│   ├── providers.tsx      # Web3 providers
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── TokenSelector.tsx  # Token picker modal
│   ├── ChainSelector.tsx  # Chain picker dropdown
│   ├── SwapCard.tsx       # Main swap interface
│   └── ...
├── lib/                   # Core libraries
│   ├── crossfund/         # CrossFund API integration
│   │   ├── swap.ts        # Swap functions
│   │   ├── quote.ts       # Quote fetching
│   │   └── transaction.ts # Transaction builder
│   ├── chains/            # Chain configurations
│   ├── tokens/            # Token lists
│   ├── merchant/          # Merchant functions
│   ├── wallet/            # Wallet utilities
│   └── x402/              # x402 protocol auth
└── types/                 # TypeScript definitions
    ├── swap.ts
    ├── chain.ts
    ├── token.ts
    └── merchant.ts
```

---

## 🔌 API Reference

### Swap Quote
```typescript
POST /api/swap/quote

Request:
{
  "fromChainId": 1,
  "fromAssetAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "toChainId": 137,
  "toAssetAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "inputAmountHuman": "100",
  "userWalletAddress": "0x..."
}

Response:
{
  "route": [...],
  "output": {
    "amount": "99.50",
    "minimumAmount": "98.51",
    "token": {...}
  },
  "swapTime": 120,
  "fees": {
    "gas": "0.002",
    "protocol": "0.30"
  }
}
```

### Create Invoice
```typescript
POST /api/merchant/invoices

Request:
{
  "amount": "100.00",
  "currency": "USD",
  "acceptedTokens": ["USDC", "USDT", "ETH"],
  "acceptedChains": [1, 137, 42161],
  "callbackUrl": "https://yoursite.com/webhook",
  "metadata": {
    "orderId": "12345"
  }
}

Response:
{
  "invoiceId": "inv_abc123",
  "paymentUrl": "https://agenti.app/pay/inv_abc123",
  "qrCode": "data:image/png;base64,...",
  "expiresAt": 1706400000
}
```

---

## 🔐 Environment Variables

```env
# CrossFund API
CROSSFUND_API_URL=https://crossfund.xyz/api
CROSSFUND_PAYMENTS_URL=https://payments.crossfund.xyz

# x402 Authentication (for API calls)
X402_PAYMENT_TOKEN_ADDRESS=0x...
X402_PAYMENT_AMOUNT=100

# Webhooks
WEBHOOK_SECRET=your-webhook-secret

# Database (optional)
DATABASE_URL=postgresql://...

# RPC URLs (fallback)
NEXT_PUBLIC_ETHEREUM_RPC=https://eth.llamarpc.com
NEXT_PUBLIC_POLYGON_RPC=https://polygon.llamarpc.com
NEXT_PUBLIC_ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
```

---

## 🌐 Supported Chains

### Layer 1
| Chain | ID | Native Token |
|-------|-----|--------------|
| Ethereum | 1 | ETH |
| BNB Smart Chain | 56 | BNB |
| Avalanche C-Chain | 43114 | AVAX |
| Fantom | 250 | FTM |
| Gnosis | 100 | xDAI |
| Celo | 42220 | CELO |
| Moonbeam | 1284 | GLMR |
| Cronos | 25 | CRO |

### Layer 2
| Chain | ID | Native Token |
|-------|-----|--------------|
| Polygon | 137 | MATIC |
| Arbitrum One | 42161 | ETH |
| Optimism | 10 | ETH |
| Base | 8453 | ETH |
| zkSync Era | 324 | ETH |
| Linea | 59144 | ETH |
| Scroll | 534352 | ETH |
| Mantle | 5000 | MNT |
| Blast | 81457 | ETH |
| Mode | 34443 | ETH |

### Non-EVM
| Chain | Type |
|-------|------|
| Solana | SVM |
| Sui | Move |
| Aptos | Move |
| Near | Near VM |
| Cosmos Hub | Cosmos SDK |

*...and 70+ more chains*

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Web3**: [wagmi](https://wagmi.sh/) + [viem](https://viem.sh/)
- **Wallet**: [RainbowKit](https://www.rainbowkit.com/)
- **QR Codes**: [qrcode](https://www.npmjs.com/package/qrcode)
- **API**: CrossFund Global Swap API

---

## 📊 Merchant Dashboard

Access the merchant dashboard at `/merchant` to:

- **View Analytics**: Track revenue, volume, and transaction counts
- **Manage Invoices**: Create, view, and cancel invoices
- **Configure Settings**: Set preferred currencies, webhooks, and more
- **Export Reports**: Download transaction history as CSV

---

## 🔒 Security

- **Non-Custodial**: Agenti never holds your funds
- **Signature Verification**: All webhooks are cryptographically signed
- **Rate Limiting**: API endpoints are protected against abuse
- **Slippage Protection**: Transactions revert if price moves unfavorably

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [CrossFund](https://crossfund.xyz) - Global Swap API
- [RainbowKit](https://rainbowkit.com) - Wallet connection
- [wagmi](https://wagmi.sh) - React hooks for Ethereum

---

## 📞 Support

- **Documentation**: [docs.agenti.app](https://docs.agenti.app)
- **Discord**: [discord.gg/agenti](https://discord.gg/agenti)
- **Twitter**: [@AgentiApp](https://twitter.com/AgentiApp)
- **Email**: support@agenti.app

---

<p align="center">
  Built with 💙 by the Agenti Team
</p>
│                   DEX Aggregators                        │
│  1inch │ 0x │ Paraswap │ Jupiter │ CoW Protocol        │
└─────────────────────────────────────────────────────────┘
```

## 📊 Supported Chains

| Chain | Status | Settlement Time |
|-------|--------|-----------------|
| Ethereum | ✅ | ~15 sec |
| Arbitrum | ✅ | ~2 sec |
| Optimism | ✅ | ~2 sec |
| Polygon | ✅ | ~2 sec |
| Base | ✅ | ~2 sec |
| Solana | 🔄 | ~400 ms |
| Avalanche | 🔄 | ~2 sec |

## 💰 Fee Structure

| Component | Fee |
|-----------|-----|
| Network Gas | Paid by sender |
| Swap Slippage | 0.1-0.5% (market) |
| Platform Fee | 0.3% |
| Cross-chain Bridge | Variable |

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/nirholas/QR.git
cd QR

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add your API keys and wallet addresses

# Run development server
npm run dev
```

## 📱 Usage

### For Recipients (Merchants/Users)

1. **Create Account** - Connect wallet + verify X handle
2. **Generate QR** - Set optional amount or leave open
3. **Share** - Display QR or share @username
4. **Receive USDC** - Automatic settlement to your wallet

### For Senders (Payers)

1. **Scan QR** or enter @username
2. **Select Token** - Pay with any token you hold
3. **Confirm** - Approve swap + transfer
4. **Done** - Recipient gets USDC instantly

## 🔐 Security

- Non-custodial: Funds flow directly wallet-to-wallet
- No private keys stored
- Audited smart contracts (pending)
- Rate limiting & fraud detection

## 🛣️ Roadmap

- [x] Core swap aggregation
- [x] QR code generation
- [ ] X handle verification (OAuth)
- [ ] Mobile app (React Native)
- [ ] Fiat off-ramp integration
- [ ] Recurring payments
- [ ] NFC tap-to-pay

## 🤝 Team

Doxxed founding team with backgrounds in:
- DeFi protocol development
- Payment processing (Stripe, Square)
- Mobile fintech

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

**Built for the future of payments** 🌐
