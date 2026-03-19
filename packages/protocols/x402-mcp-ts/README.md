# x402 + MCP + AI SDK

## Check out [apps/example](./apps/example) for a working example!

```ts
// server
import { createPaidMcpHandler } from "x402-mcp";
import z from "zod";

const handler = createPaidMcpHandler(
  (server) => {
    server.paidTool(
      "get_random_number",
      "Get a random number between two numbers",
      { price: 0.001 },
      {
        min: z.number().int(),
        max: z.number().int(),
      },
      {},
      async (args) => {
        const randomNumber =
          Math.floor(Math.random() * (args.max - args.min + 1)) + args.min;
        return {
          content: [{ type: "text", text: randomNumber.toString() }],
        };
      }
    );
  },
  {
    recipient: process.env.WALLET_ADDRESS,
  }
);

export { handler as GET, handler as POST };

// client
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { withPayment } from "x402-mcp";

const mcpClient = await createMCPClient({
  transport: new StreamableHTTPClientTransport(url),
}).then((client) => withPayment(client, { account: process.env.PRIVATE_KEY }));

const tools = await mcpClient.tools();

const result = streamText({
  model,
  tools,
  messages: convertToModelMessages(messages),
  stopWhen: stepCountIs(5),
  onFinish: async () => {
    await mcpClient.close();
  },
  system: "ALWAYS prompt the user to confirm before authorizing payments",
});
```
