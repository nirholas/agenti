import type { Request, Response, Router } from "express";
import type { Facilitator } from "../facilitator";

/**
 * Creates an Express router with X402 facilitator endpoints mounted.
 * 
 * Mounts three endpoints:
 * - GET /supported - Lists supported payment kinds
 * - POST /verify - Verifies a payment authorization
 * - POST /settle - Settles a payment on-chain
 * 
 * @param facilitator The Facilitator instance to use
 * @param router The Express router to mount the endpoints on
 * @param basePath Optional base path to mount the endpoints (default: "/")
 * 
 * @example
 * import express from "express";
 * import { Facilitator, createExpressAdapter } from "@x402-sovereign/core";
 * import { baseSepolia } from "viem/chains";
 * 
 * const app = express();
 * app.use(express.json());
 * 
 * const facilitator = new Facilitator({
 *   evmPrivateKey: process.env.EVM_PRIVATE_KEY!,
 *   networks: [baseSepolia],
 * });
 * 
 * // Mount at root
 * createExpressAdapter(facilitator, app);
 * 
 * // Or mount at a custom path
 * createExpressAdapter(facilitator, app, "/facilitator");
 */
export function createExpressAdapter(
  facilitator: Facilitator,
  router: Router,
  basePath: string = ""
): void {
  const normalizePath = (path: string) => {
    const normalized = basePath + path;
    return normalized || "/";
  };

  router.get(normalizePath("/supported"), async (req: Request, res: Response) => {
    try {
      const response = await facilitator.handleRequest({
        method: "GET",
        path: "/supported",
      });
      res.status(response.status).json(response.body);
    } catch (error) {
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.post(normalizePath("/verify"), async (req: Request, res: Response) => {
    try {
      const response = await facilitator.handleRequest({
        method: "POST",
        path: "/verify",
        body: req.body,
      });
      res.status(response.status).json(response.body);
    } catch (error) {
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.post(normalizePath("/settle"), async (req: Request, res: Response) => {
    try {
      const response = await facilitator.handleRequest({
        method: "POST",
        path: "/settle",
        body: req.body,
      });
      res.status(response.status).json(response.body);
    } catch (error) {
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

