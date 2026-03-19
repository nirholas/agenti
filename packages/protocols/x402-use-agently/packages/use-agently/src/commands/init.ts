import { Command } from "commander";
import { output } from "../output";
import { generateEvmPrivateKeyConfig } from "@use-agently/sdk";
import { loadConfig, saveConfig, backupConfig, type ConfigScope } from "../config";

export const initCommand = new Command("init")
  .description("Generate a new local wallet and save it to config")
  .option("--regenerate", "Backup existing config and generate a new wallet")
  .option("--local", "Save config to the current directory (.use-agently/config.json) instead of the home directory")
  .showHelpAfterError(true)
  .addHelpText("after", "\nConfig: ~/.use-agently/config.json (global), .use-agently/config.json (local)")
  .action(async (options: { regenerate?: boolean; local?: boolean }, command: Command) => {
    const scope: ConfigScope = options.local ? "local" : "global";
    const existing = await loadConfig(scope);
    if (existing?.wallet) {
      if (!options.regenerate) {
        console.error("Wallet already configured. Use --regenerate to create a new wallet.");
        process.exit(1);
      }
      const backupPath = await backupConfig(scope);
      console.error(`Previous config backed up to ${backupPath}`);
    }

    const walletConfig = generateEvmPrivateKeyConfig();
    await saveConfig({ wallet: walletConfig }, scope);

    output(command, {
      address: walletConfig.address,
      message: "fund this address to start using agents on use-agently.com",
    });
  });
