# Plug/Phoenix Integration

The `X402.Plug.PaymentGate` module provides drop-in payment gating for any
Plug-compatible application, including Phoenix.

## Configuration

The plug accepts these options (validated via `NimbleOptions`):

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `:facilitator_url` | string | yes | URL of the x402 facilitator |
| `:routes` | map | yes | Route patterns → payment requirements |
| `:finch` | atom | no | Finch instance name (default: `X402.Finch`) |
| `:on_payment_verified` | function | no | Callback after successful verification |
| `:on_payment_failed` | function | no | Callback after failed verification |

## Route Patterns

Routes are matched by `"METHOD /path"` strings:

```elixir
routes = %{
  "GET /api/weather" => %{price: "0.005", network: "eip155:8453", pay_to: "0x..."},
  "POST /api/generate" => %{price: "0.05", network: "eip155:8453", pay_to: "0x..."},
  "* /api/premium/*" => %{price: "0.01", network: "eip155:8453", pay_to: "0x..."}
}
```

## Custom Callbacks

```elixir
plug X402.Plug.PaymentGate,
  facilitator_url: "https://x402.org/facilitator",
  routes: routes,
  on_payment_verified: fn conn, payload ->
    Logger.info("Payment from #{payload["payerWallet"]}")
    conn
  end
```

## Telemetry Events

The plug emits these telemetry events:

- `[:x402, :plug, :payment_required]` — 402 returned to client
- `[:x402, :plug, :payment_verified]` — payment successfully verified
- `[:x402, :plug, :payment_failed]` — verification failed
