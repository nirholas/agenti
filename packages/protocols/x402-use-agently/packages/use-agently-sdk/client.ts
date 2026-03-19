import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { wrapMCPClientWithPaymentFromConfig } from "@x402/mcp";
import type { Client as McpClient } from "@modelcontextprotocol/sdk/client";
import type { Wallet } from "./wallets/wallet";
import { DryRunTransaction, type TransactionMode } from "./utils/transaction";
import { formatUnits } from "viem";
import { getChainConfigByNetwork } from "./utils/chain";
import pkg from "./package.json" with { type: "json" };

type Fetch = typeof fetch;

export interface PaymentRequirementsInfo {
  amount: string;
  network: string;
  description: string;
  payTo: string;
  asset: string;
}

/**
 * Unstable: internal SDK client type.
 * This will be the de facto SDK client type in the future.
 * But do not depend on it, it may change without a major version bump.
 *
 * THIS client provides the low-level primitives for SDK requests.
 * You do not bundle A2A, MCP, or Web protocols with this client.
 * Protocols will use this client to make requests.
 */
export type unstable_Client = {
  fetch: Fetch;
};

export function createClient(options?: { userAgent?: string }): unstable_Client {
  const fetch = createFetch({ userAgent: options?.userAgent });
  return {
    fetch: fetch,
  };
}

/** Create a fetch wrapper that automatically includes a User-Agent header. */
function createFetch(options?: { userAgent?: string }): typeof fetch {
  // @ts-expect-error — Bun's typeof fetch includes preconnect namespace (oven-sh/bun#23741)
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // When input is a Request, preserve its headers — passing init.headers to fetch() replaces them entirely.
    const isRequest = input instanceof Request;
    const headers = new Headers(isRequest ? input.headers : init?.headers);
    if (isRequest && init?.headers) {
      for (const [key, value] of new Headers(init.headers).entries()) {
        headers.set(key, value);
      }
    }
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", options?.userAgent ?? `@use-agently/sdk:${pkg.version} (use-agently.com)`);
    }
    return fetch(input, { ...init, headers });
  };
}

/** The standard fetch client for SDK requests. Automatically includes the User-Agent header. */
export const clientFetch: typeof fetch = createFetch();

function formatUsdcAmount(req: PaymentRequirementsInfo): string {
  try {
    const { usdcDecimals } = getChainConfigByNetwork(req.network);
    const raw = formatUnits(BigInt(req.amount), usdcDecimals);
    const formatted = raw.includes(".") ? raw.replace(/\.?0+$/, "") : raw;
    const network = req.network ? ` on ${req.network}` : "";
    return `$${formatted} USDC${network}`;
  } catch {
    return `${req.amount} (raw units)`;
  }
}

export class DryRunPaymentRequired extends Error {
  readonly requirements: PaymentRequirementsInfo[];

  constructor(requirements: PaymentRequirementsInfo[]) {
    const req = requirements[0];
    const amount = req ? formatUsdcAmount(req) : null;
    const payLine = amount
      ? `This request requires payment of ${amount}.\nUse createPaymentFetch() instead of createDryRunFetch() to authorize the transaction.`
      : `This request requires payment, but the amount could not be determined.\nInspect the endpoint manually or use createPaymentFetch() to authorize payment.`;
    super(payLine);
    this.name = "DryRunPaymentRequired";
    this.requirements = requirements;
  }
}

export function createDryRunFetch(fetchImpl: typeof fetch = clientFetch): typeof fetch {
  // @ts-expect-error — Bun's typeof fetch includes preconnect namespace (oven-sh/bun#23741)
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetchImpl(input, init);
    if (response.status === 402) {
      let requirements: PaymentRequirementsInfo[] = [];
      const header = response.headers.get("PAYMENT-REQUIRED");
      if (header) {
        try {
          const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
          requirements = (decoded.accepts as PaymentRequirementsInfo[]) ?? [];
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
        }
      } else {
        // Attempt to parse x402v1 body format
        try {
          const body = await response.clone().json();
          if (body?.accepts) {
            requirements = body.accepts as PaymentRequirementsInfo[];
          }
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
        }
      }
      throw new DryRunPaymentRequired(requirements);
    }
    return response;
  };
}

/** Resolve fetch for a transaction mode — dry-run intercepts 402s, pay wraps with x402 payment. */
export function resolveFetchForTransaction(
  transaction: TransactionMode = DryRunTransaction,
  fetchImpl?: typeof fetch,
): typeof fetch {
  if (transaction.mode === "dry-run") return createDryRunFetch(fetchImpl);
  return createPaymentFetch(transaction.wallet, fetchImpl) as typeof fetch;
}

export function createPaymentFetch(wallet: Wallet, fetchImpl: typeof fetch = clientFetch) {
  return wrapFetchWithPaymentFromConfig(fetchImpl, {
    schemes: wallet.getX402Schemes(),
  });
}

export function createMcpPaymentClient(mcpClient: McpClient, wallet: Wallet) {
  return wrapMCPClientWithPaymentFromConfig(mcpClient, {
    schemes: wallet.getX402Schemes(),
  });
}
