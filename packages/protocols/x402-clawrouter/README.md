<div align="center">

<img src="assets/banner.png" alt="ClawRouter Banner" width="600">

<h1>The LLM router built for autonomous agents</h1>

<p>Agents can't sign up for accounts. Agents can't enter credit cards.<br>
Agents can only sign transactions.<br><br>
<strong>ClawRouter is the only LLM router that lets agents operate independently.</strong></p>

<br>

<img src="https://img.shields.io/badge/🤖_Agent--Native-black?style=for-the-badge" alt="Agent native">&nbsp;
<img src="https://img.shields.io/badge/🔑_Zero_API_Keys-blue?style=for-the-badge" alt="No API keys">&nbsp;
<img src="https://img.shields.io/badge/⚡_Local_Routing-yellow?style=for-the-badge" alt="Local routing">&nbsp;
<img src="https://img.shields.io/badge/💰_x402_USDC-purple?style=for-the-badge" alt="x402 USDC">&nbsp;
<img src="https://img.shields.io/badge/🔓_Open_Source-green?style=for-the-badge" alt="Open source">

[![npm version](https://img.shields.io/npm/v/@blockrun/clawrouter.svg?style=flat-square&color=cb3837)](https://npmjs.com/package/@blockrun/clawrouter)
[![npm downloads](https://img.shields.io/npm/dm/@blockrun/clawrouter.svg?style=flat-square&color=blue)](https://npmjs.com/package/@blockrun/clawrouter)
[![GitHub stars](https://img.shields.io/github/stars/BlockRunAI/ClawRouter?style=flat-square)](https://github.com/BlockRunAI/ClawRouter)
[![CI](https://img.shields.io/github/actions/workflow/status/BlockRunAI/ClawRouter/ci.yml?style=flat-square&label=CI)](https://github.com/BlockRunAI/ClawRouter/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[![USDC Hackathon Winner](https://img.shields.io/badge/🏆_USDC_Hackathon-Agentic_Commerce_Winner-gold?style=flat-square)](https://x.com/USDC/status/2021625822294216977)
[![x402 Protocol](https://img.shields.io/badge/x402-Micropayments-purple?style=flat-square)](https://x402.org)
[![Base Network](https://img.shields.io/badge/Base-USDC-0052FF?style=flat-square&logo=coinbase&logoColor=white)](https://base.org)
[![Solana](https://img.shields.io/badge/Solana-USDC-9945FF?style=flat-square&logo=solana&logoColor=white)](https://solana.com)
[![OpenClaw Plugin](https://img.shields.io/badge/OpenClaw-Plugin-orange?style=flat-square)](https://openclaw.ai)
[![Telegram](https://img.shields.io/badge/Telegram-Community-26A5E4?style=flat-square&logo=telegram)](https://t.me/blockrunAI)

</div>

---

## Why ClawRouter exists

Every other LLM router was built for **human developers** — create an account, get an API key, pick a model from a dashboard, pay with a credit card.

**Agents can't do any of that.**

ClawRouter is built for the agent-first world:

- **No accounts** — a wallet is generated locally, no signup
- **No API keys** — your wallet signature IS authentication
- **No model selection** — 15-dimension scoring picks the right model automatically
- **No credit cards** — agents pay per-request with USDC via [x402](https://x402.org)
- **No trust required** — runs locally, <1ms routing, zero external dependencies

This is the stack that lets agents operate autonomously: **x402 + USDC + local routing**.

---

## How it compares

|                  | OpenRouter        | LiteLLM          | Martian           | Portkey           | **ClawRouter**          |
| ---------------- | ----------------- | ---------------- | ----------------- | ----------------- | ----------------------- |
| **Models**       | 200+              | 100+             | Smart routing     | Gateway           | **41+**                 |
| **Routing**      | Manual selection  | Manual selection | Smart (closed)    | Observability     | **Smart (open source)** |
| **Auth**         | Account + API key | Your API keys    | Account + API key | Account + API key | **Wallet signature**    |
| **Payment**      | Credit card       | BYO keys         | Credit card       | $49-499/mo        | **USDC per-request**    |
| **Runs locally** | No                | Yes              | No                | No                | **Yes**                 |
| **Open source**  | No                | Yes              | No                | Partial           | **Yes**                 |
| **Agent-ready**  | No                | No               | No                | No                | **Yes**                 |

✓ Open source · ✓ Smart routing · ✓ Runs locally · ✓ Crypto native · ✓ Agent ready

**We're the only one that checks all five boxes.**

---

## Quick Start

```bash
# 1. Install with smart routing enabled
curl -fsSL https://blockrun.ai/ClawRouter-update | bash
openclaw gateway restart

# 2. Fund your wallet with USDC on Base or Solana (address printed on install)
# $5 is enough for thousands of requests
```

Done. Smart routing (`blockrun/auto`) is now your default model.

---

## Routing Profiles

Choose your routing strategy with `/model <profile>`:

| Profile          | Strategy           | Savings | Best For         |
| ---------------- | ------------------ | ------- | ---------------- |
| `/model auto`    | Balanced (default) | 74-100% | General use      |
| `/model eco`     | Cheapest possible  | 95-100% | Maximum savings  |
| `/model premium` | Best quality       | 0%      | Mission-critical |
| `/model free`    | Free tier only     | 100%    | Zero cost        |

**Shortcuts:** `/model grok`, `/model br-sonnet`, `/model gpt5`, `/model o3`

---

## How It Works

**100% local routing. <1ms latency. Zero external API calls.**

```
Request → Weighted Scorer (15 dimensions) → Tier → Best Model → Response
```

| Tier      | ECO Model                           | AUTO Model                   | PREMIUM Model                |
| --------- | ----------------------------------- | ---------------------------- | ---------------------------- |
| SIMPLE    | nvidia/gpt-oss-120b (FREE)          | kimi-k2.5 ($0.60/$3.00)      | kimi-k2.5                    |
| MEDIUM    | gemini-2.5-flash-lite ($0.10/$0.40) | grok-code-fast ($0.20/$1.50) | gpt-5.2-codex ($1.75/$14.00) |
| COMPLEX   | gemini-2.5-flash-lite ($0.10/$0.40) | gemini-3.1-pro ($2/$12)      | claude-opus-4.6 ($5/$25)     |
| REASONING | grok-4-fast ($0.20/$0.50)           | grok-4-fast ($0.20/$0.50)    | claude-sonnet-4.6 ($3/$15)   |

**Blended average: $2.05/M** vs $25/M for Claude Opus = **92% savings**

---

## Image Generation

Generate images directly from chat with `/imagegen`:

```
/imagegen a dog dancing on the beach
/imagegen --model dall-e-3 a futuristic city at sunset
/imagegen --model banana-pro --size 2048x2048 mountain landscape
```

| Model         | Provider              | Price       | Max Size  |
| ------------- | --------------------- | ----------- | --------- |
| `nano-banana` | Google Gemini Flash   | $0.05/image | 1024x1024 |
| `banana-pro`  | Google Gemini Pro     | $0.10/image | 4096x4096 |
| `dall-e-3`    | OpenAI DALL-E 3       | $0.04/image | 1792x1024 |
| `gpt-image`   | OpenAI GPT Image 1    | $0.02/image | 1536x1024 |
| `flux`        | Black Forest Flux 1.1 | $0.04/image | 1024x1024 |

## Image Editing (img2img)

Edit existing images with `/img2img`:

```
/img2img --image ~/photo.png change the background to a starry sky
/img2img --image ./cat.jpg --mask ./mask.png remove the background
```

| Option            | Required | Description                           |
| ----------------- | -------- | ------------------------------------- |
| `--image <path>`  | Yes      | Local image file path (supports `~/`) |
| `--mask <path>`   | No       | Mask image (white = area to edit)     |
| `--model <model>` | No       | Model to use (default: `gpt-image-1`) |
| `--size <WxH>`    | No       | Output size (default: `1024x1024`)    |

**API endpoint:** `POST http://localhost:8402/v1/images/image2image` — see [full docs](docs/image-generation.md#post-v1imagesimage2image).

---

## Models & Pricing

41+ models across 7 providers, one wallet:

<details>
<summary><strong>Click to expand full model list</strong></summary>

| Model                   | Input $/M | Output $/M | Context | Reasoning |
| ----------------------- | --------- | ---------- | ------- | :-------: |
| **OpenAI**              |           |            |         |           |
| gpt-5.2                 | $1.75     | $14.00     | 400K    |    \*     |
| gpt-4o                  | $2.50     | $10.00     | 128K    |           |
| gpt-4o-mini             | $0.15     | $0.60      | 128K    |           |
| gpt-oss-120b            | **FREE**  | **FREE**   | 128K    |           |
| o1                      | $15.00    | $60.00     | 200K    |    \*     |
| o1-mini                 | $1.10     | $4.40      | 128K    |    \*     |
| o3                      | $2.00     | $8.00      | 200K    |    \*     |
| o4-mini                 | $1.10     | $4.40      | 128K    |    \*     |
| **Anthropic**           |           |            |         |           |
| claude-opus-4.6         | $5.00     | $25.00     | 200K    |    \*     |
| claude-sonnet-4.6       | $3.00     | $15.00     | 200K    |    \*     |
| claude-haiku-4.5        | $1.00     | $5.00      | 200K    |           |
| **Google**              |           |            |         |           |
| gemini-3.1-pro          | $2.00     | $12.00     | 1M      |    \*     |
| gemini-3-pro-preview    | $2.00     | $12.00     | 1M      |    \*     |
| gemini-3-flash-preview  | $0.50     | $3.00      | 1M      |           |
| gemini-2.5-pro          | $1.25     | $10.00     | 1M      |    \*     |
| gemini-2.5-flash        | $0.30     | $2.50      | 1M      |           |
| gemini-2.5-flash-lite   | $0.10     | $0.40      | 1M      |           |
| **DeepSeek**            |           |            |         |           |
| deepseek-chat           | $0.28     | $0.42      | 128K    |           |
| deepseek-reasoner       | $0.28     | $0.42      | 128K    |    \*     |
| **xAI**                 |           |            |         |           |
| grok-4-0709             | $0.20     | $1.50      | 131K    |    \*     |
| grok-4-1-fast-reasoning | $0.20     | $0.50      | 131K    |    \*     |
| grok-code-fast-1        | $0.20     | $1.50      | 131K    |           |
| **Moonshot**            |           |            |         |           |
| kimi-k2.5               | $0.60     | $3.00      | 262K    |    \*     |
| **MiniMax**             |           |            |         |           |
| minimax-m2.5            | $0.30     | $1.20      | 205K    |    \*     |

</details>

> **Free tier:** `gpt-oss-120b` costs nothing and serves as automatic fallback when wallet is empty.

---

## Payment

No account. No API key. **Payment IS authentication** via [x402](https://x402.org).

```
Request → 402 (price: $0.003) → wallet signs USDC → retry → response
```

USDC stays in your wallet until spent — non-custodial. Price is visible in the 402 header before signing.

**Dual-chain support:** Pay with **USDC** on **Base (EVM)** or **USDC on Solana**. Both wallets are derived from a single BIP-39 mnemonic on first run.

```bash
/wallet              # Check balance and address (both chains)
/wallet export       # Export mnemonic + keys for backup
/wallet recover      # Restore wallet from mnemonic on a new machine
/wallet solana       # Switch to Solana USDC payments
/wallet base         # Switch back to Base (EVM) USDC payments
/chain solana        # Alias for /wallet solana
/stats               # View usage and savings
/stats clear         # Reset usage statistics
```

**Fund your wallet:**

- **Base (EVM):** Send USDC on Base to your EVM address
- **Solana:** Send USDC on Solana to your Solana address
- **Coinbase/CEX:** Withdraw USDC to either network
- **Credit card:** Reach out to [@bc1max on Telegram](https://t.me/bc1max)

---

## Screenshots

<table>
<tr>
<td width="50%" align="center">
<strong>Smart Routing in Action</strong><br><br>
<img src="docs/clawrouter-savings.png" alt="ClawRouter savings" width="400">
</td>
<td width="50%" align="center">
<strong>Telegram Integration</strong><br><br>
<img src="assets/telegram-demo.png" alt="Telegram demo" width="400">
</td>
</tr>
</table>

---

## Configuration

For basic usage, no configuration needed. For advanced options:

| Variable                    | Default                               | Description             |
| --------------------------- | ------------------------------------- | ----------------------- |
| `BLOCKRUN_WALLET_KEY`       | auto-generated                        | Your wallet private key |
| `BLOCKRUN_PROXY_PORT`       | `8402`                                | Local proxy port        |
| `CLAWROUTER_DISABLED`       | `false`                               | Disable smart routing   |
| `CLAWROUTER_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint     |

**Full reference:** [docs/configuration.md](docs/configuration.md)

---

## Troubleshooting

**When things go wrong, run the doctor:**

```bash
npx @blockrun/clawrouter doctor
```

This collects diagnostics and sends them to Claude Sonnet for AI-powered analysis:

```
🩺 BlockRun Doctor v0.12.24

System
  ✓ OS: darwin arm64
  ✓ Node: v20.11.0

Wallet
  ✓ Address: 0x1234...abcd
  ✓ Balance: $12.50

Network
  ✓ BlockRun API: reachable (142ms)
  ✗ Local proxy: not running on :8402

📤 Sending to Claude Sonnet 4.6 (~$0.003)...

🤖 AI Analysis:
The local proxy isn't running. Run `openclaw gateway restart` to fix.
```

**Use Opus for complex issues:**

```bash
npx @blockrun/clawrouter doctor opus
```

**Ask a specific question:**

```bash
npx @blockrun/clawrouter doctor "why is my request failing?"
npx @blockrun/clawrouter doctor opus "深度分析我的配置"
```

**Cost:** Sonnet ~$0.003 (default) | Opus ~$0.01

---

## Development

```bash
git clone https://github.com/BlockRunAI/ClawRouter.git
cd ClawRouter
npm install
npm run build
npm test
```

---

## Support

| Channel               | Link                                                               |
| --------------------- | ------------------------------------------------------------------ |
| 📅 Schedule Demo      | [calendly.com/vickyfu9/30min](https://calendly.com/vickyfu9/30min) |
| 💬 Community Telegram | [t.me/blockrunAI](https://t.me/blockrunAI)                         |
| 🐦 X / Twitter        | [x.com/blockrunai](https://x.com/blockrunai)                       |
| 📱 Founder Telegram   | [@bc1max](https://t.me/bc1max)                                     |
| ✉️ Email              | vicky@blockrun.ai                                                  |

---

## From the BlockRun Ecosystem

<table>
<tr>
<td width="50%">

### ⚡ ClawRouter

**The LLM router built for autonomous agents**

You're here. 41+ models, local smart routing, x402 USDC payments — the only stack that lets agents operate independently.

`curl -fsSL https://blockrun.ai/ClawRouter-update | bash`

</td>
<td width="50%">

### 🦞 [SocialClaw](https://github.com/BlockRunAI/socialclaw)

**Intelligence-as-a-function for X/Twitter**

The first X analytics an agent can call. One function call = one intelligence report. $0.08, not $49/month. No dashboard, no login, no subscription.

`pip install blockrun-llm[solana]`

[![GitHub](https://img.shields.io/github/stars/BlockRunAI/socialclaw?style=flat-square)](https://github.com/BlockRunAI/socialclaw)

</td>
</tr>
</table>

---

## More Resources

| Resource                                               | Description              |
| ------------------------------------------------------ | ------------------------ |
| [Documentation](https://blockrun.ai/docs)              | Full docs                |
| [Model Pricing](https://blockrun.ai/models)            | All models & prices      |
| [Image Generation & Editing](docs/image-generation.md) | API examples, 5 models   |
| [Routing Profiles](docs/routing-profiles.md)           | ECO/AUTO/PREMIUM details |
| [Architecture](docs/architecture.md)                   | Technical deep dive      |
| [Configuration](docs/configuration.md)                 | Environment variables    |
| [Troubleshooting](docs/troubleshooting.md)             | Common issues            |

---

<div align="center">

**MIT License** · [BlockRun](https://blockrun.ai) — Agent-native AI infrastructure

⭐ If ClawRouter powers your agents, consider starring the repo!

</div>
