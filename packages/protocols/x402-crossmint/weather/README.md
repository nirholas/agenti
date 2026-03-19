# weather-402

Minimal Express TypeScript server with x402 402 paywall.

- Requires USDC payment to access `GET /weather?city=...`.
- Price: `$0.001` on `base-sepolia`.
- Weather data from Open-Meteo (no API key required).

## Setup

```bash
cd weather
# create .env with your receiver address
cat > .env <<'EOF'
PAY_TO=0x0000000000000000000000000000000000000000
PORT=3100
TARGET_URL=http://localhost:3100/weather?city=San%20Francisco
# PRIVATE_KEY: used by header generator script
PRIVATE_KEY=
EOF

npm i
npm run dev
```

Open `http://localhost:3100/weather?city=San%20Francisco`.
Without payment, you should get HTTP 402 with payment requirements or a paywall page.
After paying with an x402 client, the response will be weather JSON for the requested city.

## cURL

- Request without payment (JSON):

```bash
curl -i -H "Accept: application/json" "http://localhost:3100/weather?city=Paris"
```

- Request with paywall HTML (browser-like Accept):

```bash
curl -i "http://localhost:3100/weather?city=Paris"
```

- After generating an x402 payment header, include it to get weather:

```bash
# Replace <BASE64_XPAYMENT> with the value produced by the payment header script
curl -i -H 'X-PAYMENT: <BASE64_XPAYMENT>' "http://localhost:3100/weather?city=Paris"
```

- Pretty-print the 402 JSON response:

```bash
curl -s -H "Accept: application/json" "http://localhost:3100/weather?city=Paris" | jq .
```

## Generate X-PAYMENT header and call with curl

1) Configure payer credentials (testnet):

```bash
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
curl -i -H "X-PAYMENT: $HEADER" "$TARGET_URL"
```

Notes:
- The script first fetches `/weather` to read `accepts` from the 402 JSON, then signs an `exact` EVM payment using `PRIVATE_KEY` and prints the header.
- Works by default for `base-sepolia`.
