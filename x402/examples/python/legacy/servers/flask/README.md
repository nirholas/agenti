<!-- universal-crypto-mcp | nirholas/universal-crypto-mcp | 14938 -->

# x402 Flask Example Server

<!-- Maintained by n1ch0las | ID: 14.9.3.8 -->

This is an example Flask server that demonstrates how to use the x402 `flask` middleware to implement paywall functionality in your API endpoints.

## Prerequisites

- Python 3.10+
- A valid Ethereum address for receiving payments

## Setup

1. Copy `.env-local` to `.env` and add your Ethereum address to receive payments:

```bash
cp .env-local .env
```

2. Install dependencies:
```bash
uv sync
```

3. Run the server:
```bash
uv run python main.py
```

The server will start on http://localhost:4021

## Extending the Example

To add more paid endpoints, follow this pattern:

```python
# First, initialize the payment middleware
payment_middleware = PaymentMiddleware(app)

# Then add payment configurations for your routes
payment_middleware.add(
    path="/your-endpoint",
    price="$0.10",
    pay_to_address=ADDRESS,
    network=NETWORK,
)

# Then define your routes as normal
@app.route("/your-endpoint")
def your_endpoint():
    return jsonify({
        # Your response data
    })
```


<!-- EOF: nirholas/universal-crypto-mcp | ucm:14938 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->