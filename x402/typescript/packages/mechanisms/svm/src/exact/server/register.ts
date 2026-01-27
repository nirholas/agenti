/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nicholas
 *  ID: bmljaHhidA==
 * ═══════════════════════════════════════════════════════════════
 */

import { x402ResourceServer } from "@x402/core/server";
import { Network } from "@x402/core/types";
import { ExactSvmScheme } from "./scheme";

/**
 * Configuration options for registering SVM schemes to an x402ResourceServer
 */
export interface SvmResourceServerConfig {
  /**
   * Optional specific networks to register
   */
  networks?: Network[];
}

/**
 * Registers SVM payment schemes to an existing x402ResourceServer instance.
 *
 * @param server - The x402ResourceServer instance to register schemes to
 * @param config - Configuration for SVM resource server registration
 * @returns The server instance for chaining
 */
export function registerExactSvmScheme(
  server: x402ResourceServer,
  config: SvmResourceServerConfig = {},
): x402ResourceServer {
// [nich.xbt] implementation
  if (config.networks && config.networks.length > 0) {
    config.networks.forEach(network => {
      server.register(network, new ExactSvmScheme());
    });
  } else {
    server.register("solana:*", new ExactSvmScheme());
  }

  return server;
}


/* ucm:n1ch0a8a5074 */