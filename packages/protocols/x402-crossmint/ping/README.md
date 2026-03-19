# ping

Minimal Express TypeScript server with x402 402 paywall.

- Requires USDC payment to access `GET /ping`.
- Default network: `base-sepolia`.

## Setup

```bash
cd basic-402
cp .env.example .env
# edit PAY_TO to your EVM address
npm i
npm run dev
```

Open http://localhost:3000/ping. Without payment, you should get 402 with payment requirements or a paywall page. After paying with an x402 client, response will be `{ "message": "pong" }`.

## cURL

- Request without payment (JSON):

```bash
curl -i -H "Accept: application/json" http://localhost:3000/ping
```

- Request with paywall HTML (browser-like Accept):

```bash
curl -i http://localhost:3000/ping
```

- After generating an x402 payment header, include it to get `pong`:

```bash
# Replace <BASE64_XPAYMENT> with the value produced by an x402 client (e.g., x402-axios)
curl -i -H 'X-PAYMENT: <BASE64_XPAYMENT>' http://localhost:3000/ping
```

- Pretty-print the 402 JSON response:

```bash
curl -s -H "Accept: application/json" http://localhost:3000/ping | jq .
```

On success, the response will include the `X-PAYMENT-RESPONSE` header and a JSON body `{ "message": "pong" }`.

## Generate X-PAYMENT header and call with curl

1) Configure payer credentials (testnet):

```bash
cp .env.example .env
# set PRIVATE_KEY to the payer EVM private key (Base Sepolia recommended)
# set TARGET_URL if different
```

2) Generate header:

```bash
npm run payment:header
# outputs a long Base64 string
```

3) Use the header with curl:

```bash
HEADER=$(npm run -s payment:header)
curl -i -H "X-PAYMENT: $HEADER" $TARGET_URL
```

Notes:
- The script first fetches `/ping` to read `accepts` from the 402 JSON, then signs an `exact` EVM payment using `PRIVATE_KEY` and prints the header.
- Works by default for `base-sepolia`.