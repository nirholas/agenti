# Chapter 3: Building Blocks - A Progressive Journey

Welcome! In this chapter, we'll build our CRE workflow step by step, starting from scratch. We'll begin with the simplest Capability and gradually add more complexity. By the end, you'll have a complete understanding of how CRE workflows work.

## Starting Your CRE Project

### Creating a New Workflow

When you start a new CRE project, you use the `cre init` command. For this workshop, we're working with an existing project, but let's understand what a fresh CRE project looks like:

```bash
cre init
cd my-project
bun install --cwd ./my-workflow
cre workflow simulate my-workflow
```

### Project Structure

After initialization, a CRE project has this structure:

```
my-project/
├── project.yaml                 # Project-level settings (RPCs, targets)
├── secrets.yaml                 # Secret variable mappings
└── my-workflow/                 # Your workflow directory
    ├── workflow.yaml            # Workflow-specific settings
    ├── main.ts                  # Workflow entry point
    ├── config.staging.json      # Workflow configuration for simulation
    ├── config.production.json   # Workflow configuration for production
    ├── package.json             # Node.js dependencies
    └── tsconfig.json            # TypeScript configuration
```

### Key Files Explained

**`project.yaml`** - Defines project-wide settings (UPDATE with Base Sepolia details):

```yaml
staging-settings:
  rpcs:
    - chain-name: ethereum-testnet-sepolia-base-1
      url: https://sepolia.base.org
```

**`workflow.yaml`** - Maps targets to workflow files:

```yaml
staging-settings:
  user-workflow:
    workflow-name: "my-workflow"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.json"
    secrets-path: "../secrets.yaml"
```

**`config.staging.json`** - Your workflow's configuration, used for local simulations (loaded at runtime)

**`config.production.json`** - Your workflow's configuration, for production usage (loaded at runtime)

**`main.ts`** - Your workflow's entry point

### The Runner Pattern

All CRE workflows use the **Runner pattern** to initialize and run workflows. This connects the [trigger-and-callback model from Chapter 2](chapter-2-mental-model.md#the-trigger-and-callback-model):

```typescript
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
```

The `initWorkflow` function returns an array of handlers, each connecting a trigger to a callback using `cre.handler()`. This is the foundation of every CRE workflow.

## Step 1: Your First Workflow - Cron Trigger

Let's start with the simplest capability: **Cron**. This will run on a schedule and just log a message.

### Minimal Cron Example

Create `main.ts`:

```typescript
import { cre, Runner, type Runtime } from "@chainlink/cre-sdk";

// Simple config type
type Config = {
  schedule: string;
};

// Initialize workflow
const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();

  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

// Callback function
function onCronTrigger(runtime: Runtime<Config>): string {
  runtime.log("Hello from CRE! Cron trigger fired!");
  return "Success";
}

// Main entry point
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
```

Create `config.json`:

```json
{
  "schedule": "0 */1 * * * *"
}
```

### Testing Your First Workflow

```bash
cd my-project
cre workflow simulate my-workflow
```

You should see:

```
[USER LOG] Hello from CRE! Cron trigger fired!

Workflow Simulation Result:
 "Hello world!"

[SIMULATION] Execution finished signal received
```

**🎉 Congratulations!** You've created your first CRE workflow. Notice:

- The workflow compiled to WASM
- It ran locally but made real calls (if any)
- Multiple nodes would execute this in production with consensus

## Step 2: Adding EVM Read - Fetching Prices

Now let's add blockchain interaction. We'll read from Chainlink Price Feeds to get current prices.

### Reading from a Contract

Add this to your workflow:

```typescript
import {
  cre,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  Runtime,
  Runner,
  LAST_FINALIZED_BLOCK_NUMBER,
} from "@chainlink/cre-sdk";
import { encodeFunctionData, decodeFunctionResult, zeroAddress } from "viem";

type EvmConfig = {
  chainSelectorName: string;
};

type Config = {
  schedule: string;
  evms: EvmConfig[];
};

// Chainlink Price Feed ABI (simplified)
const priceFeedAbi = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

function onCronTrigger(runtime: Runtime<Config>): bigint {
  // Get the first EVM configuration from the list.
  const evmConfig = runtime.config.evms[0];

  // Get network configuration
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Unknown chain name: ${evmConfig.chainSelectorName}`);
  }

  // Create EVM client
  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Encode function call
  const callData = encodeFunctionData({
    abi: priceFeedAbi,
    functionName: "latestRoundData",
    args: [],
  });

  // Execute contract call (with consensus!)
  const contractCall = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298", // BTC/USD feed on Base Sepolia
        data: callData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();

  // Decode result
  const priceData = decodeFunctionResult({
    abi: priceFeedAbi,
    functionName: "latestRoundData",
    data: bytesToHex(contractCall.data),
  }) as [bigint, bigint, bigint, bigint, bigint];

  // Convert price (8 decimals)
  const priceUsd = Number(priceData[1]) / 10 ** 8;

  runtime.log(`BTC Price: $${priceUsd.toFixed(2)}`);

  return priceData[1];
}

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();

  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
```

### Understanding EVM Read

**Key points:**

- `getNetwork()` - Gets chain configuration
- `EVMClient` - Client for blockchain interactions
- `encodeFunctionData()` - Encodes Solidity function calls
- `callContract()` - Executes read (no gas needed)
- **Consensus**: Multiple nodes read, results aggregated via BFT

### Update Config

_Make sure you added `"ethereum-testnet-sepolia-base-1"` to `project.yaml` already, as desribed above._

```json
{
  "schedule": "0 */1 * * * *",
  "evms": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia-base-1"
    }
  ]
}
```

**Test it:** Run the simulation again. You should see the BTC price logged!

```
[USER LOG] BTC Price: $92325.42

Workflow Simulation Result:
 9232542000000

[SIMULATION] Execution finished signal received
```

### Reading Multiple Values from Contracts

In our actual workflow (`cronCallback.ts`), we also read rules from the `RuleRegistry` contract. Here's how we read multiple values:

```typescript
// Read all rules from RuleRegistry (from cronCallback.ts)
const registryAbi = [
  {
    name: "getAllRules",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          { name: "asset", type: "string" },
          { name: "condition", type: "string" },
          { name: "targetPriceUsd", type: "uint256" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const callData = encodeFunctionData({
  abi: registryAbi,
  functionName: "getAllRules",
  args: [],
});

const result = evmClient
  .callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: ruleRegistryAddress,
      data: callData,
    }),
  })
  .result();

const rules = decodeFunctionResult({
  abi: registryAbi,
  functionName: "getAllRules",
  data: bytesToHex(result.data),
}) as Rule[];
```

This pattern allows you to read complex data structures (like arrays of structs) from contracts.

## Step 3: Adding EVM Write - Storing Data On-Chain

Now let's write data to a contract. This requires a two-step process: generate a report, then write it. This matches the pattern used in our `httpCallback.ts` file.

### The Two-Step Write Pattern

```typescript
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { hexToBase64, bytesToHex, TxStatus, getNetwork } from "@chainlink/cre-sdk";
import { cre } from "@chainlink/cre-sdk";

// Example: Writing alert data to RuleRegistry (from httpCallback.ts)
function writeAlertToContract(
  runtime: Runtime<Config>,
  alert: { id: string; asset: string; condition: string; targetPriceUsd: bigint; createdAt: bigint }
): string {
  // Get network and EVM client
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evms[0].chainSelectorName,
    isTestnet: true,
  });

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Step 1: Ensure ID has 0x prefix for bytes32
  const idBytes32 = alert.id.startsWith("0x") ? alert.id : `0x${alert.id}`;

  // Step 2: Encode your data as ABI parameters
  const reportData = encodeAbiParameters(
    parseAbiParameters("bytes32 id, string asset, string condition, uint256 targetPriceUsd, uint256 createdAt"),
    [idBytes32, alert.asset, alert.condition, alert.targetPriceUsd, alert.createdAt]
  );

  // Step 3: Generate CRE report (cryptographically signed)
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  // Step 4: Write report to contract
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.evms[0].ruleRegistryAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.evms[0].gasLimit,
      },
    })
    .result();

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    return txHash;
  }

  throw new Error(`Transaction failed: ${writeResult.txStatus}`);
}
```

### Why Two Steps?

1. **Report Generation**: Creates a cryptographically signed report that the contract can verify
2. **Write Report**: Submits the signed report on-chain

This pattern ensures data integrity and allows the contract to verify the report's authenticity. Our `RuleRegistry` contract implements `IReceiverTemplate` to receive and verify these CRE reports.

## Step 4: Adding HTTP Trigger - Receiving External Data

Now let's add an HTTP trigger to receive data from external services. This matches the pattern used in our `main.ts` and `httpCallback.ts` files.

### HTTP Trigger Setup

```typescript
import { cre, Runner, type Runtime, type HTTPPayload, decodeJson } from "@chainlink/cre-sdk";

// Update initWorkflow to include HTTP trigger (from main.ts)
const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  const http = new cre.capabilities.HTTPCapability();

  return [
    cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
    cre.handler(
      http.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: "", // Empty string for demo, required for production
          },
        ],
      }),
      onHttpTrigger
    ),
  ];
};

// HTTP trigger handler (from httpCallback.ts pattern)
function onHttpTrigger(runtime: Runtime<Config>, payload: HTTPPayload): string {
  if (!payload.input || payload.input.length === 0) {
    return "Empty request";
  }

  // Decode JSON payload
  const inputData = decodeJson(payload.input);

  runtime.log(`Received: ${JSON.stringify(inputData)}`);

  // In our actual workflow, we would:
  // 1. Extract alert data (id, asset, condition, targetPriceUsd, createdAt)
  // 2. Encode as ABI parameters
  // 3. Generate CRE report
  // 4. Write to RuleRegistry contract

  return "Success";
}
```

### Testing HTTP Trigger

```bash
cre workflow simulate my-workflow
```

Select **HTTP trigger** (option 2):

```
🚀 Workflow simulation ready. Please select a trigger:
1. cron-trigger@1.0.0 Trigger
2. http-trigger@1.0.0-alpha Trigger

Enter your choice (1-2): 2
```

And then paste the following JSON:

```json
{ "id": "0x123...", "asset": "BTC", "condition": "gt", "targetPriceUsd": 60000, "createdAt": 1234567890 }
```

This matches the format our server sends to the CRE workflow.

You should see:

```
[USER LOG] Received: {"asset":"BTC","condition":"gt","createdAt":1234567890,"id":"0x123...","targetPriceUsd":60000}

Workflow Simulation Result:
 "Success"

[SIMULATION] Execution finished signal received
```

## Step 5: Adding HTTP Client - Making External Calls

Finally, let's make HTTP requests to external APIs (like sending notifications). This matches the pattern used in our `cronCallback.ts` for Pushover notifications.

### HTTP Client Example

```typescript
import { cre, ok, consensusIdenticalAggregation, type HTTPSendRequester } from "@chainlink/cre-sdk";

const httpClient = new cre.capabilities.HTTPClient();

// Example: Sending Pushover notification (from cronCallback.ts)
const sendPushoverNotification =
  (message: string, title: string, apiToken: string, userId: string) =>
  (sendRequester: HTTPSendRequester, config: Config) => {
    const payload = {
      token: apiToken,
      user: userId,
      message: message,
      title: title,
    };

    // Encode body as base64 (required by CRE HTTP Client)
    const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));
    const body = Buffer.from(bodyBytes).toString("base64");

    const req = {
      url: "https://api.pushover.net/1/messages.json",
      method: "POST" as const,
      body,
      headers: {
        "Content-Type": "application/json",
      },
      cacheSettings: {
        readFromCache: true,
        maxAgeMs: 60000, // Cache for 1 minute
      },
    };

    const resp = sendRequester.sendRequest(req).result();

    if (!ok(resp)) {
      throw new Error(`Request failed: ${resp.statusCode}`);
    }

    // Decode and verify response
    const responseText = new TextDecoder().decode(resp.body);
    const responseBody = JSON.parse(responseText);
    if (responseBody.status !== 1) {
      throw new Error(`API returned error: ${JSON.stringify(responseBody)}`);
    }

    return { statusCode: resp.statusCode };
  };

// Use with consensus aggregation (from cronCallback.ts)
const result = httpClient
  .sendRequest(
    runtime,
    sendPushoverNotification(
      "BTC is now $60,123.45 (alert target: > $60,000.00)",
      "CRE PRICE ALERT",
      pushoverApiKey,
      pushoverUserId
    ),
    consensusIdenticalAggregation<{ statusCode: number }>()
  )(runtime.config)
  .result();
```

### Consensus for HTTP Calls

Notice `consensusIdenticalAggregation` - multiple nodes make the same HTTP call, and results are aggregated via BFT consensus. This ensures reliability even if one API endpoint is down or returns incorrect data. Every HTTP call in CRE benefits from this built-in consensus mechanism.

### Cache for HTTP Calls

Notice `cacheSettings` - By default, all nodes in the DON execute HTTP requests. For POST, PUT, PATCH, and DELETE operations, this would cause duplicate actions (like creating multiple resources or sending multiple emails). By utilizing `cacheSettings`, we can ensure that only one node makes the call and prevent duplicate requests. The first node makes the HTTP request and stores the response in the cache. Other nodes will first check the cache before attempting to make the HTTP request on their own. All nodes will still participate in consensus, even if the cache is used.

## Step 6: Connecting x402 Server to CRE

Now that we understand CRE capabilities, let's see how the x402-protected server integrates with our CRE workflow. This connects the concepts from Chapter 2 with the CRE building blocks we just learned.

### Server-Side: x402 Payment Protection

Our server uses x402 middleware to protect the `/alerts` endpoint (from `server/src/server.ts`):

```typescript
import { paymentMiddleware } from "x402-express";
import { createHash } from "node:crypto";

// x402 payment middleware (from server.ts)
app.use(
  paymentMiddleware(
    process.env.X402_RECEIVER_ADDRESS, // Payment recipient
    {
      "POST /alerts": {
        price: "$0.01",
        network: "base-sepolia",
        config: {
          description: "Create a crypto price alert",
        },
      },
    },
    { url: "https://x402.org/facilitator" }
  )
);

// /alerts endpoint handler (from server.ts)
app.post("/alerts", (req, res) => {
  // Payment already validated by middleware!

  // Create alert with deterministic ID
  const alertData = {
    asset: req.body.asset,
    condition: req.body.condition,
    targetPriceUsd: req.body.targetPriceUsd,
    createdAt: Math.floor(Date.now() / 1000),
  };

  const id = createHash("sha256").update(JSON.stringify(alertData)).digest("hex");

  const alert = { id, ...alertData };

  // Output CRE workflow payload (for manual trigger in demo)
  console.log("\nCRE Workflow Payload (copy for HTTP trigger):");
  console.log(JSON.stringify(alert));

  res.json({ success: true, alert });
});
```

### Client-Side: x402 Payment Handling

The client uses `x402-fetch` to automatically handle the payment flow (from `server/src/x402Client.ts`):

```typescript
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

// Wrap fetch with x402 payment handling
const account = privateKeyToAccount(process.env.AGENT_WALLET_PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

// Make request - x402-fetch automatically handles payment
const response = await fetchWithPayment("http://localhost:3000/alerts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    asset: "BTC",
    condition: "gt",
    targetPriceUsd: 60000,
  }),
});

// Payment settled! Get transaction hash from header
const paymentResponse = response.headers.get("x-payment-response");
const data = await response.json();
```

### The Complete Flow

Here's how x402 and CRE work together:

1. **Client → Server**: User sends request to `/alerts` endpoint
2. **x402 Payment**: Server responds with `402 Payment Required`, client pays $0.01 USDC
3. **Server → CRE**: Server outputs CRE payload JSON (in demo, you manually trigger CRE)
4. **CRE HTTP Trigger**: Receives alert data via HTTP trigger (Step 4)
5. **CRE EVM Write**: Writes alert to RuleRegistry contract (Step 3)
6. **CRE Cron Trigger**: Periodically checks prices (Step 1)
7. **CRE EVM Read**: Reads prices and rules (Step 2)
8. **CRE HTTP Client**: Sends notifications when conditions met (Step 5)

### Key Integration Points

- **x402 protects the API**: Payment is the authorization (no API keys needed)
- **Server creates alert data**: After payment, server generates the alert payload
- **CRE receives via HTTP Trigger**: The alert data is sent to CRE's HTTP trigger
- **CRE writes on-chain**: The workflow writes the alert to the RuleRegistry contract
- **CRE monitors automatically**: Cron trigger checks prices and sends notifications

This demonstrates how x402 (micropayments) and CRE (decentralized workflows) work together to create a complete, payment-protected, on-chain automation system.

## Putting It All Together

Now you understand the complete picture:

- **Cron Trigger** - Scheduled execution
- **EVM Read** - Reading from blockchains (with consensus)
- **EVM Write** - Writing to blockchains (two-step pattern)
- **HTTP Trigger** - Receiving external data
- **HTTP Client** - Making external API calls (with consensus)
- **x402 Integration** - Payment-protected API that triggers CRE workflows

In the next chapter, we'll set up and run the complete price alert system using all these Capabilities together!
