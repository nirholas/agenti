# X402

[![Hex.pm](https://img.shields.io/hexpm/v/x402.svg)](https://hex.pm/packages/x402)
[![Downloads](https://img.shields.io/hexpm/dt/x402.svg)](https://hex.pm/packages/x402)
[![Docs](https://img.shields.io/badge/hex-docs-blue.svg)](https://hexdocs.pm/x402)
[![CI](https://github.com/cardotrejos/x402/actions/workflows/ci.yml/badge.svg)](https://github.com/cardotrejos/x402/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-89%25-green.svg)](https://github.com/cardotrejos/x402)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**The Elixir SDK for the [x402](https://x402.org) HTTP payment protocol.**

x402 is an open standard for internet-native payments built around the HTTP `402 Payment Required` status code. This library provides everything you need to accept or make x402 payments in Elixir.

## Features

- **Protocol primitives** — encode/decode `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` headers
- **Facilitator client** — verify and settle payments via any x402 facilitator
- **Plug middleware** — drop-in payment gate for Phoenix and Plug apps
- **Lifecycle hooks** — before/after/failure callbacks for verify & settle flows
- **Payment identifier** — idempotency extension with pluggable cache
- **"upto" scheme** — max-price bidding for flexible payments
- **SIWX (Sign-In-With-X)** — wallet-authenticated repeat access without repayment
- **Wallet validation** — EVM (Ethereum, Base, Polygon) and Solana address validation
- **Zero lock-in** — works with any facilitator, any chain, any framework
- **Fully typed** — comprehensive typespecs and Dialyzer-clean

## Installation

Add `x402` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:x402, "~> 0.3"},
    {:finch, "~> 0.19"},        # HTTP client (required for facilitator calls)
    {:ex_secp256k1, "~> 0.8"},  # Only if using SIWX signature verification
    {:ex_keccak, "~> 0.7"}      # Only if using SIWX signature verification
  ]
end
```

> `finch`, `ex_secp256k1`, and `ex_keccak` are optional. Only add what you need.

## Quick Start

### Accept payments in Phoenix

```elixir
# In your router or endpoint
plug X402.Plug.PaymentGate,
  facilitator_url: "https://x402-facilitator-app.fly.dev",
  routes: %{
    "GET /api/weather" => %{
      price: "0.005",
      network: "eip155:8453",
      pay_to: "0xYourWalletAddress",
      description: "Weather data API"
    }
  }
```

That's it. Requests without payment get a `402` response with payment instructions. Requests with a valid `PAYMENT-SIGNATURE` header are verified and passed through.

### With lifecycle hooks

```elixir
defmodule MyApp.PaymentHooks do
  @behaviour X402.Hooks

  @impl true
  def before_verify(context, _metadata) do
    IO.inspect(context.payment, label: "Incoming payment")
    {:ok, context}
  end

  @impl true
  def after_verify(context, _metadata) do
    # Log successful verification, trigger webhooks, etc.
    {:ok, context}
  end

  @impl true
  def after_settle(context, _metadata) do
    # Post-settlement logic: update DB, send receipt
    {:ok, context}
  end

  @impl true
  def on_verify_failure(context, _metadata), do: {:ok, context}

  @impl true
  def before_settle(context, _metadata), do: {:ok, context}

  @impl true
  def on_settle_failure(context, _metadata), do: {:ok, context}
end

# Use in PaymentGate
plug X402.Plug.PaymentGate,
  facilitator_url: "https://x402-facilitator-app.fly.dev",
  hooks: MyApp.PaymentHooks,
  routes: %{...}
```

### "upto" scheme — flexible pricing

```elixir
# Server: accept up to a max price (agent bids what they're willing to pay)
plug X402.Plug.PaymentGate,
  facilitator_url: "https://x402-facilitator-app.fly.dev",
  routes: %{
    "GET /api/premium" => %{
      scheme: "upto",
      maxPrice: "1.00",
      network: "eip155:8453",
      pay_to: "0xYourWallet",
      description: "Premium data — pay what you want up to $1"
    }
  }

# Encode/decode upto payment requirements
{:ok, header} = X402.PaymentRequired.encode(%{
  accepts: [%{
    scheme: "upto",
    network: "eip155:8453",
    maxPrice: "1.00",
    pay_to: "0xYourWallet"
  }],
  description: "Pay up to $1"
})
```

### Payment identifier — idempotency

Prevent duplicate payments by attaching unique payment IDs:

```elixir
# Start the ETS cache in your supervision tree
children = [
  {X402.Extensions.PaymentIdentifier.ETSCache, []}
]

# Encode a payment ID into a payload
{:ok, encoded} = X402.Extensions.PaymentIdentifier.encode("pay-abc-123")

# Decode it back
{:ok, payment_id} = X402.Extensions.PaymentIdentifier.decode(encoded)
#=> {:ok, "pay-abc-123"}

# Check/store in cache for deduplication
:ok = X402.Extensions.PaymentIdentifier.ETSCache.put("pay-abc-123")
{:ok, true} = X402.Extensions.PaymentIdentifier.ETSCache.exists?("pay-abc-123")
```

### SIWX — Sign-In-With-X (repeat access)

Let paying users prove wallet ownership to access content again without repaying:

```elixir
# 1. Build a SIWX challenge message (CAIP-122 / EIP-4361)
message = X402.Extensions.SIWX.build_message(%{
  domain: "api.example.com",
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  uri: "https://api.example.com/premium",
  chain_id: 8453,
  nonce: X402.Extensions.SIWX.generate_nonce(),
  statement: "Sign in to access premium content"
})

# 2. Verify the wallet's signature (EVM)
{:ok, true} = X402.Extensions.SIWX.Verifier.Default.verify_signature(
  message,
  signature_hex,
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
)

# 3. Store access record with TTL
{:ok, _pid} = X402.Extensions.SIWX.ETSStorage.start_link([])

:ok = X402.Extensions.SIWX.ETSStorage.put(
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "/premium",
  %{tx: "0xabc..."},
  :timer.hours(24)  # 24-hour access
)

# 4. Check if wallet has valid access
{:ok, record} = X402.Extensions.SIWX.ETSStorage.get(
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "/premium"
)
```

### Encode/decode headers manually

```elixir
# Build a PAYMENT-REQUIRED response
{:ok, header} = X402.PaymentRequired.encode(%{
  accepts: [%{
    scheme: "exact",
    network: "eip155:8453",
    price: "0.01",
    pay_to: "0xYourWallet"
  }],
  description: "Premium API access"
})

# Decode an incoming PAYMENT-SIGNATURE
{:ok, payload} = X402.PaymentSignature.decode(signature_header)

# Verify payment via facilitator
{:ok, result} = X402.Facilitator.verify(payload, requirements)
```

### Verify payments programmatically

```elixir
# Start the facilitator client in your supervision tree
children = [
  {Finch, name: MyApp.Finch},
  {X402.Facilitator, name: MyApp.Facilitator, finch: MyApp.Finch}
]

# Then verify payments
{:ok, %{status: 200}} = X402.Facilitator.verify(
  MyApp.Facilitator,
  payment_payload,
  payment_requirements
)
```

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  AI Agent    │────▶│  Your API + x402     │────▶│  Facilitator │
│  (payer)     │◀────│  PaymentGate Plug    │◀────│  (verify/    │
└─────────────┘     │                      │     │   settle)    │
                    │  ┌──────────────┐    │     └──────────────┘
                    │  │ Hooks        │    │
                    │  │ PaymentID    │    │
                    │  │ SIWX Storage │    │
                    │  └──────────────┘    │
                    └──────────────────────┘
```

## Documentation

Full documentation is available at [HexDocs](https://hexdocs.pm/x402).

- [Getting Started](https://hexdocs.pm/x402/getting-started.html)
- [Plug/Phoenix Integration](https://hexdocs.pm/x402/plug-integration.html)
- [API Reference](https://hexdocs.pm/x402/api-reference.html)

## x402 Protocol

x402 is an open standard by [Coinbase](https://coinbase.com) for HTTP-native payments:

1. Client requests a paid resource
2. Server returns `402 Payment Required` with pricing info
3. Client pays (USDC on Base, Solana, etc.)
4. Client retries with `PAYMENT-SIGNATURE` header
5. Server verifies via facilitator and serves the resource

Learn more at [x402.org](https://x402.org) and [docs.x402.org](https://docs.x402.org).

## Related

- [`x402_proxy`](https://github.com/cardotrejos/x402_proxy) — reverse proxy that adds x402 payment gating to any API
- [`x402_facilitator`](https://github.com/cardotrejos/x402_facilitator) — x402 facilitator + payment gateway ([live](https://x402-facilitator-app.fly.dev))
- [x402 TypeScript SDK](https://github.com/coinbase/x402) — official Coinbase SDK
- [x402 Python SDK](https://pypi.org/project/x402/) — Python implementation

## License

MIT License — see [LICENSE](LICENSE) for details.
