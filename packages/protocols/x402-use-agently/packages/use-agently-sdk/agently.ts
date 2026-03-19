import { unstable_Client } from "./client";

const BASE_URL = "https://api.use-agently.com";

export interface ERC8004Metadata {
  type: string;
  name: string;
  description: string;
  image?: string;
  active?: boolean;
  services?: ERC8004Service[];
  x402support?: boolean;
  registrations?: Array<{ agentId: number; agentRegistry: string }>;
  ens?: string;
  did?: string;
}

export interface ERC8004Service {
  name: string;
  endpoint: string;
  version: string;
  tools?: string[];
  prompts?: string[];
  resources?: string[];
}

export interface ERC8004Agent {
  id: string;
  chain_id: string;
  address: string;
  agent_id: string;
  owner: string | null;
  name: string;
  description: string;
  protocols: string[];
  created_at: string;
}

export interface SearchOptions {
  q?: string;
  chain_id?: string[];
  protocol?: string[];
  page?: number;
  per_page?: number;
}

export interface SearchResult {
  hits: ERC8004Agent[];
  found: number;
  page: number;
  per_page: number;
}

export interface GetAgent extends ERC8004Agent {
  metadata: ERC8004Metadata;
}

export async function search(client: unstable_Client, options?: SearchOptions): Promise<SearchResult> {
  const url = new URL("/search", BASE_URL);
  if (options?.q) url.searchParams.set("q", options.q);
  if (options?.chain_id) {
    for (const chain of options.chain_id) {
      url.searchParams.append("chain_id", chain);
    }
  }
  if (options?.protocol) {
    for (const proto of options.protocol) {
      url.searchParams.append("protocol", proto);
    }
  }
  if (options?.page !== undefined) url.searchParams.set("page", String(options.page));
  if (options?.per_page !== undefined) url.searchParams.set("per_page", String(options.per_page));

  const response = await client.fetch(url);
  if (!response.ok) {
    throw new Error(`Agently search failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getAgent(client: unstable_Client, id: string): Promise<GetAgent | undefined> {
  const normalizedId = id.startsWith("eip155:") ? id.toLowerCase() : id;
  const url = new URL(`/agents/${normalizedId}`, BASE_URL);
  const response = await client.fetch(url);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Agently lookup failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
