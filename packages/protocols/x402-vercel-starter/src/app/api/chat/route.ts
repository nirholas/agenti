import { convertToModelMessages, stepCountIs, streamText, UIMessage } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { withPayment } from "x402-mcp";
import { tool } from "ai";
import z from "zod";
import { getOrCreatePurchaserAccount } from "@/lib/accounts";
import { env } from "@/lib/env";

export const maxDuration = 30;

export const POST = async (request: Request) => {
  const { messages, model }: { messages: UIMessage[]; model: string } =
    await request.json();

  const account = await getOrCreatePurchaserAccount();

  const mcpClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL("/mcp", env.URL)),
  }).then((client) => withPayment(client, { account, network: env.NETWORK }));

  const tools = await mcpClient.tools();

  const result = streamText({
    model,
    tools: {
      ...tools,
      "hello-local": tool({
        description: "Receive a greeting",
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async (args) => {
          return `Hello ${args.name}`;
        },
      }),
    },
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    onFinish: async () => {
      await mcpClient.close();
    },
    system: "ALWAYS prompt the user to confirm before authorizing payments",
  });
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
    messageMetadata: () => ({ network: env.NETWORK }),
  });
};
