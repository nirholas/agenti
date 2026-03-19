/**
 * Chainlink CRE (Chainlink Runtime Environment) Workflow
 * 
 * This is the main entry point for the CRE workflow that handles:
 * 1. HTTP Trigger: Receives alert data from server and writes it on-chain to RuleRegistry
 * 2. Cron Trigger: Periodically checks price conditions and sends Pushover notifications
 * 
 * Architecture:
 * - HTTP Trigger (evm.ts): Writes alerts to RuleRegistry contract via CRE reports
 * - Cron Trigger (alert.ts): Fetches price data, checks rules, sends notifications when conditions are met
 * 
 * Flow:
 * 1. server → HTTP Trigger → RuleRegistry contract (on-chain storage)
 * 2. Cron job → Fetch prices → Check rules → Send Pushover notifications
 */

import { cre, Runner } from "@chainlink/cre-sdk";
import { onHttpTrigger } from "./httpCallback";
import { onCronTrigger } from "./cronCallback";
import type { Config } from "./types";

// ============================================================================
// Workflow Initialization
// ============================================================================

/**
 * Initializes the CRE workflow with HTTP and Cron triggers
 * 
 * @param config - Workflow configuration
 * @returns Array of workflow handlers
 */
const initWorkflow = (config: Config) => {
  const http = new cre.capabilities.HTTPCapability();
  const cron = new cre.capabilities.CronCapability();

  return [
    cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
    cre.handler(
      http.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.publicKey,
          },
        ],
      }),
      onHttpTrigger
    ),
  ];
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main entry point for the CRE workflow
 */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
