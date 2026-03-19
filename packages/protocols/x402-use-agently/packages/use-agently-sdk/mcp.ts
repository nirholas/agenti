import { Client } from "@modelcontextprotocol/sdk/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { x402MCPClient, x402MCPToolCallResult } from "@x402/mcp";
import {
  DryRunPaymentRequired,
  resolveFetchForTransaction,
  createMcpPaymentClient,
  clientFetch,
  type unstable_Client,
} from "./client";
import { DryRunTransaction, PayTransaction, type TransactionMode } from "./utils/transaction";
import type { Wallet } from "./wallets/wallet";
import { getAgent } from "./agently";
import pkg from "./package.json" with { type: "json" };

export interface McpCallOptions {
  transaction?: TransactionMode;
  fetchImpl?: typeof fetch;
  clientInfo?: { name: string; version: string };
}

/**
 * Resolve a URI to an MCP endpoint URL.
 *
 * For HTTP(S) URLs, ensures the path ends with `/mcp`.
 * For ERC-8004 URIs (`eip155:...`), resolves via the Agently API
 * using the first MCP service endpoint from the agent metadata.
 *
 * ```
 * getMcpURL("https://example.com/") => "https://example.com/mcp"
 * getMcpURL("https://example.com/mcp") => "https://example.com/mcp"
 * getMcpURL("eip155:1/erc8004:0x.../123") => resolves via getAgent(), returns MCP service endpoint
 * ```
 */
export async function getMcpURL(client: unstable_Client, input: string): Promise<URL> {
  if (input.startsWith("eip155:")) {
    const agent = await getAgent(client, input);
    if (!agent) {
      throw new Error(`Agent (${input}) not found.`);
    }
    const service = agent.metadata?.services?.find((s) => s.name.toLowerCase() === "mcp");
    if (!service) {
      throw new Error(`Agent (${input}) has no MCP service registered.`);
    }
    return new URL(service.endpoint);
  }

  return new URL(input);
}

async function createMcpClient(
  mcpUrl: string,
  options: { clientInfo?: { name: string; version: string }; fetchImpl?: typeof fetch; wallet: Wallet },
): Promise<x402MCPClient>;
async function createMcpClient(
  mcpUrl: string,
  options?: { clientInfo?: { name: string; version: string }; fetchImpl?: typeof fetch },
): Promise<Client>;
async function createMcpClient(
  mcpUrl: string,
  options?: { clientInfo?: { name: string; version: string }; fetchImpl?: typeof fetch; wallet?: Wallet },
): Promise<Client | x402MCPClient> {
  const client = new Client(options?.clientInfo ?? { name: "@use-agently/sdk", version: pkg.version });
  const transport = new StreamableHTTPClientTransport(
    new URL(mcpUrl),
    options?.fetchImpl ? { fetch: options.fetchImpl } : undefined,
  );

  if (options?.wallet) {
    const x402Client = createMcpPaymentClient(client, options.wallet);
    await x402Client.connect(transport);
    return x402Client;
  }

  await client.connect(transport);
  return client;
}

/** List all tools available on an MCP server. */
export async function listMcpTools(sdkClient: unstable_Client, uri: string, options?: McpCallOptions): Promise<Tool[]> {
  const mcpUrl = await (await getMcpURL(sdkClient, uri)).toString();
  const resolvedFetch = resolveFetchForTransaction(options?.transaction, options?.fetchImpl);
  const client = await createMcpClient(mcpUrl, { clientInfo: options?.clientInfo, fetchImpl: resolvedFetch });
  try {
    const { tools } = await client.listTools();
    return tools;
  } finally {
    await client.close();
  }
}

/** Call a tool on an MCP server, with optional payment support. Defaults to dry-run mode. */
export async function callMcpTool(
  sdkClient: unstable_Client,
  uri: string,
  tool: string,
  args?: Record<string, unknown>,
): Promise<CallToolResult>;
export async function callMcpTool(
  sdkClient: unstable_Client,
  uri: string,
  tool: string,
  args: Record<string, unknown> | undefined,
  options: McpCallOptions & { transaction: PayTransaction },
): Promise<x402MCPToolCallResult>;
export async function callMcpTool(
  sdkClient: unstable_Client,
  uri: string,
  tool: string,
  args: Record<string, unknown> | undefined,
  options: McpCallOptions & { transaction: DryRunTransaction },
): Promise<CallToolResult>;
export async function callMcpTool(
  sdkClient: unstable_Client,
  uri: string,
  tool: string,
  args: Record<string, unknown> | undefined,
  options: McpCallOptions,
): Promise<CallToolResult | x402MCPToolCallResult>;
export async function callMcpTool(
  sdkClient: unstable_Client,
  uri: string,
  tool: string,
  args?: Record<string, unknown>,
  options?: McpCallOptions,
): Promise<CallToolResult | x402MCPToolCallResult> {
  const mcpUrl = await (await getMcpURL(sdkClient, uri)).toString();
  const transaction = options?.transaction ?? DryRunTransaction;
  const resolvedFetch = resolveFetchForTransaction(transaction, options?.fetchImpl);

  if (transaction.mode === "pay") {
    // Use the caller's fetchImpl (e.g. User-Agent), but skip the payment-wrapped fetch —
    // x402MCPClient handles payment at the MCP protocol level.
    const x402Client = await createMcpClient(mcpUrl, {
      clientInfo: options?.clientInfo,
      fetchImpl: options?.fetchImpl ?? clientFetch,
      wallet: transaction.wallet,
    });
    try {
      return await x402Client.callTool(tool, args ?? {});
    } finally {
      await x402Client.close();
    }
  }

  // Dry-run mode
  const client = await createMcpClient(mcpUrl, { clientInfo: options?.clientInfo, fetchImpl: resolvedFetch });
  try {
    const result = await client.callTool({ name: tool, arguments: args ?? {} });
    if (result.isError) {
      const content = result.content as Array<{ type: string; text?: string }>;
      if (content?.length > 0 && content[0].type === "text" && content[0].text) {
        try {
          const parsed = JSON.parse(content[0].text);
          if (Array.isArray(parsed?.accepts) && parsed.accepts.length > 0) {
            throw new DryRunPaymentRequired(parsed.accepts);
          }
        } catch (e) {
          if (e instanceof DryRunPaymentRequired) throw e;
        }
      }
    }
    return result as CallToolResult;
  } finally {
    await client.close();
  }
}
