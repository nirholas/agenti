import { Command } from "commander";
import { output } from "../output";
import { loadWallet } from "@use-agently/sdk";
import { getConfigOrThrow } from "../config";

export const whoamiCommand = new Command("whoami")
  .description("Show current wallet info")
  .showHelpAfterError(true)
  .action(async (_options: Record<string, never>, command: Command) => {
    const config = await getConfigOrThrow();
    const wallet = loadWallet(config.wallet);

    output(command, {
      namespace: "eip155",
      address: wallet.address,
    });
  });
