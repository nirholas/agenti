import { randomUUID } from "node:crypto";
import type { AgentCard } from "@a2a-js/sdk";
import { ClientFactory, JsonRpcTransportFactory, RestTransportFactory } from "@a2a-js/sdk/client";
import { resolveFetchForTransaction, type unstable_Client } from "./client";
import type { TransactionMode } from "./utils/transaction";
import { getAgent } from "./agently";

export interface MessageResult {
  text: string;
  raw: unknown;
}

function extractTextFromParts(parts: any[]): string {
  return parts
    .filter((p) => p.kind === "text")
    .map((p) => p.text)
    .join("");
}

export function extractAgentText(result: any): string {
  if (!result) {
    return "The agent processed your request but returned no response.";
  }

  // Direct message response
  if (result.kind === "message" && result.parts) {
    return extractTextFromParts(result.parts);
  }

  // Task-based response — agent messages
  const messages = result.kind === "task" ? result.messages : result.task?.messages || result.messages;
  if (messages) {
    const text = messages
      .filter((m: { role: string }) => m.role === "agent")
      .flatMap((m: { parts: unknown[] }) => extractTextFromParts(m.parts))
      .join("\n");
    if (text) return text;
  }

  // Task artifacts response
  const artifacts = result.artifacts || result.task?.artifacts;
  if (artifacts && artifacts.length > 0) {
    const text = artifacts.flatMap((a: { parts: unknown[] }) => extractTextFromParts(a.parts)).join("\n");
    if (text) return text;
  }

  return result.text || "The agent processed your request but returned no text response.";
}

export function extractStreamEventText(event: any): string {
  if (event.kind === "artifact-update") {
    return extractTextFromParts(event.artifact?.parts || []);
  }
  if (event.kind === "message" && event.role === "agent") {
    return extractTextFromParts(event.parts || []);
  }
  return "";
}

export async function createA2AClient(client: unstable_Client, uri: string, fetchImpl: typeof fetch) {
  const url = await getAgentCardURL(client, uri);
  const factory = new ClientFactory({
    transports: [new JsonRpcTransportFactory({ fetchImpl }), new RestTransportFactory({ fetchImpl })],
  });
  return factory.createFromUrl(url.toString(), "");
}

/** Send a message to an A2A agent and return the complete result. */
export async function sendMessage(
  client: unstable_Client,
  uri: string,
  message: string,
  options?: {
    mode?: TransactionMode;
  },
): Promise<MessageResult> {
  const resolvedFetch = resolveFetchForTransaction(options?.mode, client.fetch);
  const a2aClient = await createA2AClient(client, uri, resolvedFetch);

  const result = await a2aClient.sendMessage({
    message: {
      kind: "message",
      messageId: randomUUID(),
      role: "user",
      parts: [{ kind: "text", text: message }],
    },
  });

  return { text: extractAgentText(result), raw: result };
}

/** Send a message to an A2A agent and return the stream for real-time iteration. */
export async function sendMessageStream(
  client: unstable_Client,
  uri: string,
  message: string,
  options?: {
    mode?: TransactionMode;
  },
): Promise<AsyncIterable<unknown>> {
  const resolvedFetch = resolveFetchForTransaction(options?.mode, client.fetch);
  const a2aClient = await createA2AClient(client, uri, resolvedFetch);

  return a2aClient.sendMessageStream({
    message: {
      kind: "message",
      messageId: randomUUID(),
      role: "user",
      parts: [{ kind: "text", text: message }],
    },
  });
}

/** Resolve a URI and fetch the A2A agent card. */
export async function getAgentCard(client: unstable_Client, uri: string): Promise<AgentCard> {
  const url = await getAgentCardURL(client, uri);
  const response = await client.fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent card from ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Resolve a URI to an A2A agent card URL.
 *
 * For HTTP(S) URLs, appends `/.well-known/agent-card.json` before the last path segment
 * if not already present. For ERC-8004 URIs (`eip155:...`), resolves via the Agently API
 * using the first service endpoint from the agent metadata.
 *
 * ```
 * getURL("https://abc.com/") => "https://abc.com/.well-known/agent-card.json"
 * getURL("https://abc.com/.well-known/agent-card.json") => "https://abc.com/.well-known/agent-card.json"
 * getURL("https://abc.com/path/something") => "https://abc.com/path/.well-known/agent-card.json"
 * getURL("eip155:1/erc8004:0x.../123") => resolves via getAgent(), returns first service endpoint
 * ```
 */
async function getAgentCardURL(client: unstable_Client, uri: string): Promise<URL> {
  if (uri.startsWith("eip155:")) {
    const agent = await getAgent(client, uri);
    if (!agent) {
      throw new Error(`Agent (${uri}) not found.`);
    }
    const service = agent.metadata?.services?.find((s) => s.name.toLowerCase() === "a2a");
    if (!service) {
      throw new Error(`Agent (${uri}) has no A2A service registered.`);
    }
    return new URL(service.endpoint);
  }

  const url = new URL(uri);
  if (url.pathname.endsWith("/.well-known/agent-card.json")) {
    return url;
  }

  // Insert .well-known/agent-card.json before the last segment
  url.pathname = url.pathname.replace(/\/?$/, "/.well-known/agent-card.json");
  return url;
}
