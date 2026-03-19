import { Command } from "commander";
import { output } from "../output";
import { loadWallet, getBalance } from "@use-agently/sdk";
import { getConfigOrThrow } from "../config";

export const balanceCommand = new Command("balance")
  .description("Check wallet balance on-chain")
  .option("--rpc <url>", "Custom RPC URL")
  .showHelpAfterError(true)
  .action(async (options: { rpc?: string }, command: Command) => {
    const config = await getConfigOrThrow();
    const wallet = loadWallet(config.wallet);
    const result = await getBalance(wallet.address, { rpc: options.rpc });
    output(command, result);
  });
