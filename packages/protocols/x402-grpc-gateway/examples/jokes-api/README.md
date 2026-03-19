# Jokes API Example

A fun example showing how to monetize API access with x402. Pay a tiny amount to get a programming joke!

Inspired by the Coinbase x402 examples - because who doesn't want to get paid for sharing bad jokes? 😄

## What This Does

A simple gRPC-gateway service that requires payment to access programming jokes. Perfect for demonstrating micropayments!

- **Free endpoint**: `/health` - No payment required
- **Paid endpoint**: `/v1/joke` - Costs $0.0001 (one hundredth of a cent!)

## Why This Example?

This shows how easy it is to monetize ANY API with x402:
- Content APIs (jokes, quotes, facts)
- AI/LLM APIs (pay per token)
- Data APIs (weather, stocks, crypto prices)
- Computational APIs (image processing, video encoding)

If you can build an API, you can monetize it with a few lines of code.

## Running

```bash
export FACILITATOR_URL="https://facilitator.x402.org"
export RECIPIENT_ADDRESS="0xYourAddress"
go run main.go
```

## Testing

### Without Payment (Returns 402)

```bash
curl -v http://localhost:8080/v1/joke
```

Response:
```json
{
  "error": "Payment required",
  "paymentRequirements": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "0.0001",
      "resource": "/v1/joke",
      "description": "Get a programming joke",
      "recipient": "0xYourAddress",
      "assetContract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    }
  ]
}
```

### With Payment (Returns Joke)

```bash
curl http://localhost:8080/v1/joke \
  -H "X-PAYMENT: <your-payment-signature>"
```

Response:
```json
{
  "joke": "Why do programmers prefer dark mode? Because light attracts bugs!",
  "paid": true,
  "payer": "0xYourAddress",
  "amount": "0.0001"
}
```

## The Business Model

At $0.0001 per joke:
- **1,000 jokes** = $0.10
- **10,000 jokes** = $1.00
- **1,000,000 jokes** = $100

Micropayments unlock business models that were impossible before:
- No subscription fatigue
- No minimum purchase amounts
- Pay exactly for what you use
- Global, instant settlement

## Jokes Included

The example includes a collection of programming jokes that rotate randomly:
- "Why do programmers prefer dark mode? Because light attracts bugs!"
- "How many programmers does it take to change a lightbulb? None, that's a hardware problem."
- "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'"
- And more!

## Extend This

Want to build your own paid API? Fork this example and swap jokes for:
- AI-generated content
- Real-time data feeds
- Computational services
- Premium features

The x402 middleware stays the same - just change what you return!
