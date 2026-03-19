import type { Context, Hono } from "hono";
import type { Facilitator } from "../facilitator";

/**
 * Creates a Hono app with X402 facilitator endpoints mounted.
 * 
 * Mounts three endpoints:
 * - GET /supported - Lists supported payment kinds
 * - POST /verify - Verifies a payment authorization
 * - POST /settle - Settles a payment on-chain
 * 
 * @param facilitator The Facilitator instance to use
 * @param basePath Optional base path to mount the endpoints (default: "/")
 * 
 * @example
 * import { Hono } from "hono";
 * import { Facilitator, createHonoAdapter } from "@x402-sovereign/core";
 * import { baseSepolia } from "viem/chains";
 * 
 * const app = new Hono();
 * const facilitator = new Facilitator({
 *   evmPrivateKey: process.env.EVM_PRIVATE_KEY!,
 *   networks: [baseSepolia],
 * });
 * 
 * // Mount at root
 * createHonoAdapter(facilitator, app);
 * 
 * // Or mount at a custom path
 * createHonoAdapter(facilitator, app, "/facilitator");
 */
export function createHonoAdapter(
  facilitator: Facilitator,
  app: Hono,
  basePath: string = ""
): void {
  const normalizePath = (path: string) => {
    const normalized = basePath + path;
    return normalized || "/";
  };

  app.get(normalizePath("/supported"), async (c: Context) => {
    const response = await facilitator.handleRequest({
      method: "GET",
      path: "/supported",
    });
    return c.json(response.body, response.status as any);
  });

  app.post(normalizePath("/verify"), async (c: Context) => {
    const body = await c.req.json().catch(() => undefined);
    const response = await facilitator.handleRequest({
      method: "POST",
      path: "/verify",
      body,
    });
    return c.json(response.body, response.status as any);
  });

  app.post(normalizePath("/settle"), async (c: Context) => {
    const body = await c.req.json().catch(() => undefined);
    const response = await facilitator.handleRequest({
      method: "POST",
      path: "/settle",
      body,
    });
    return c.json(response.body, response.status as any);
  });
}

