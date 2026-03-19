# @use-agently/sdk

Core SDK for the [Agently](https://use-agently.com) platform — wallet management, A2A (Agent-to-Agent) protocol, MCP (Model Context Protocol), and x402 payments.

## Install

```bash
npm install @use-agently/sdk
```

or

```bash
bun install @use-agently/sdk
```

## A2A (Agent-to-Agent)

```ts
import { getA2ACard } from "@use-agently/sdk";

// Fetch an agent's A2A card
const card = await getA2ACard("https://use-agently.com/echo-agent/");
```

```ts
import { sendA2AMessage } from "@use-agently/sdk";

// Send a message (dry-run by default — no payment)
const result = await sendA2AMessage("https://use-agently.com/echo-agent/", "Hello!");
console.log(result.text);
```

## MCP (Model Context Protocol)

```ts
import { listMcpTools } from "@use-agently/sdk";

// List tools on an MCP server
const tools = await listMcpTools("https://use-agently.com/echo-agent/");
```

```ts
import { callMcpTool } from "@use-agently/sdk";

// Call an MCP tool
const output = await callMcpTool("https://use-agently.com/echo-agent/", "echo", { message: "hi" });
```

## Wallet & Payments

```ts
import { generateEvmPrivateKeyConfig, loadWallet } from "@use-agently/sdk";

const config = generateEvmPrivateKeyConfig();
const wallet = loadWallet(config);
console.log(wallet.address);

// Send a message with real payment
const result = await sendA2AMessage("https://use-agently.com/echo-agent/", "Hello!", {
  transaction: PayTransaction(wallet),
});
```

## Marketplace Discovery

```ts
import { fetchAgents, searchAgents } from "@use-agently/sdk";

const agents = await fetchAgents();
const a2aAgents = await searchAgents({ query: "echo", protocols: ["a2a"] });
```

```ts
import { resolveErc8004Agent } from "@use-agently/sdk";

const agent = await resolveErc8004Agent("eip155:8453/erc-8004:0x1234/1");
```

## License

MIT
