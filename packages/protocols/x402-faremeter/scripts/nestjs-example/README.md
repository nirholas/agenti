# Nest.js with Faremeter Middleware Example

This example demonstrates how to integrate Faremeter's Express middleware with a Nest.js application to enable micropayments for API endpoints.

## Running the Faremeter Facilitator

Make sure you have the facilitator running:

```bash
cd apps/facilitator && pnpm tsx src
```

## Running the Nest.js Server

Set your EVM receiving address in your environment:

```bash
export EVM_RECEIVING_ADDRESS=0x<YOUR_ADDRESS_HERE>
```

From the **scripts** directory (important!), run:

```bash
cd scripts
pnpm tsx --tsconfig ./nestjs-example/tsconfig.json ./nestjs-example/server-nestjs.ts
```

You should see:

```
[Nest] 57083  - 08/20/2025, 12:47:22 PM     LOG [NestFactory] Starting Nest application...
[Nest] 57083  - 08/20/2025, 12:47:22 PM     LOG [InstanceLoader] AppModule dependencies initialized +4ms
[Nest] 57083  - 08/20/2025, 12:47:22 PM     LOG [RoutesResolver] AppController {/}: +3ms
[Nest] 57083  - 08/20/2025, 12:47:22 PM     LOG [RouterExplorer] Mapped {/weather, GET} route +1ms
[Nest] 57083  - 08/20/2025, 12:47:22 PM     LOG [NestApplication] Nest application successfully started +1ms
Nest.js server with Faremeter middleware listening on port 4021
```

## Testing the Integration

### Without Payment (Returns 402 Payment Required)

```bash
curl http://localhost:4021/weather
```

### With Payment

From the scripts directory:

```bash
cd scripts
EVM_PRIVATE_KEY=<YOUR_ADDRESS_HERE> pnpm tsx evm-example/base-sepolia-payment.ts
```

You should see:

```bash
Creating wallet for Base Sepolia USDC payments...
Wallet address: 0x<YOUR_PAYER_ADDRESS_HERE>
Making payment request to http://localhost:4021/weather...
Status: 200
Headers: {
  connection: 'keep-alive',
  'content-length': '76',
  'content-type': 'application/json; charset=utf-8',
  date: 'Wed, 20 Aug 2025 19:47:30 GMT',
  etag: 'W/"4c-XV+T7udgJ3f7In7X0jAkCAR4pDA"',
  'keep-alive': 'timeout=5',
  'x-powered-by': 'Express'
}
Response: {
  temperature: 72,
  conditions: 'sunny',
  message: 'Thanks for your payment!'
}
```
