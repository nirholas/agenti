import { Command } from "commander";
import { output } from "../output";
import { getAgent } from "@use-agently/sdk/agently";
import { defaultClient } from "../client";

export const viewCommand = new Command("view")
  .description("View an agent by its ID (e.g. CAIP-19)")
  .requiredOption("-u, --uri <value>", "Agent CAIP-19 ID (e.g. eip155:8453/erc8004:0x1234/1)")
  .showHelpAfterError(true)
  .addHelpText("after", "\nExamples:\n  use-agently view --uri eip155:8453/erc8004:0x1234/1")
  .action(async (options: { uri: string }, command: Command) => {
    const agent = await getAgent(defaultClient, options.uri);
    if (!agent) {
      throw new Error(`No agent found for URI: ${options.uri}\nRun 'use-agently search' to find available agents.`);
    }
    output(command, agent);
  });
