# x402 Demo Web UI

React frontend for the x402 payment-gated content demo.

## Features

- Wallet balance display with real-time refresh
- Content selection with pricing (6 content items)
- 3-step payment flow:
  1. **Request Content** - Fetches content, receives 402 Payment Required
  2. **Confirm Payment** - Signs and submits payment via AgentKit wallet
  3. **View Content** - Displays the purchased content data
- Agent reasoning display showing each step
- Debug log panel with HTTP request/response details
- Transaction confirmation with block explorer links

## Payment Flow

The UI guides users through a step-by-step payment process:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Step 1:        │     │  Step 2:        │     │  Step 3:        │
│  Request        │────▶│  Confirm        │────▶│  View           │
│  Content        │     │  Payment        │     │  Content        │
│                 │     │                 │     │                 │
│  Agent requests │     │  Agent signs    │     │  Agent presents │
│  content, gets  │     │  payment and    │     │  the purchased  │
│  402 response   │     │  retries with   │     │  data in a      │
│                 │     │  X-PAYMENT      │     │  readable       │
│                 │     │  header         │     │  format         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Each step is a separate API call, keeping requests under the 29-second API Gateway timeout.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your endpoints
```

## Development

```bash
npm run dev
# Open http://localhost:5173
```

## Configuration

Edit `.env`:

```bash
# API endpoint (Lambda proxy to AgentCore)
VITE_API_ENDPOINT=https://<api-id>.execute-api.<region>.amazonaws.com/prod/
```

## Build

```bash
npm run build
```

Output goes to `dist/` for deployment.

## Stack

- React 18
- TypeScript
- Vite
- CSS

## License

MIT-0
