# Getting Started

This guide walks you through adding x402 payments to an Elixir application.

## Installation

Add `x402` and a HTTP client to your dependencies:

```elixir
def deps do
  [
    {:x402, "~> 0.1"},
    {:finch, "~> 0.19"}
  ]
end
```

## Start the Facilitator Client

Add the facilitator to your application's supervision tree:

```elixir
# lib/my_app/application.ex
children = [
  {Finch, name: MyApp.Finch},
  {X402.Facilitator,
    name: MyApp.X402,
    url: "https://x402.org/facilitator",
    finch: MyApp.Finch}
]
```

## Verify a Payment

```elixir
payment_payload = %{
  "transactionHash" => "0xabc...",
  "network" => "eip155:8453",
  "scheme" => "exact",
  "payerWallet" => "0x1234..."
}

requirements = %{
  "scheme" => "exact",
  "network" => "eip155:8453",
  "price" => "0.01",
  "payTo" => "0xYourWallet"
}

case X402.Facilitator.verify(MyApp.X402, payment_payload, requirements) do
  {:ok, %{status: 200}} -> IO.puts("Payment verified!")
  {:error, reason} -> IO.inspect(reason, label: "Verification failed")
end
```

## Use the Plug Middleware

For the simplest integration, use the Plug middleware in your Phoenix router:

```elixir
# lib/my_app_web/router.ex
pipeline :paid_api do
  plug X402.Plug.PaymentGate,
    facilitator_url: "https://x402.org/facilitator",
    routes: %{
      "GET /api/data" => %{
        price: "0.01",
        network: "eip155:8453",
        pay_to: "0xYourWallet"
      }
    }
end

scope "/api" do
  pipe_through [:api, :paid_api]
  get "/data", DataController, :show
end
```

Unpaid requests receive a `402 Payment Required` response with the pricing details
encoded in the `PAYMENT-REQUIRED` header. Clients that include a valid
`PAYMENT-SIGNATURE` header are passed through to your controller.
