import { Command } from "commander";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { output } from "../output";
import { loadWallet } from "@use-agently/sdk";
import { loadConfig } from "../config";

interface Check {
  name: string;
  ok: boolean;
  message?: string;
}

export const doctorCommand = new Command("doctor")
  .description("Run environment checks and report any issues")
  .option("--rpc <url>", "Custom RPC URL to use for network check")
  .showHelpAfterError(true)
  .addHelpText("after", "\nConfig: ~/.use-agently/config.json (global), .use-agently/config.json (local)")
  .action(async (options: { rpc?: string }, command: Command) => {
    const checks: Check[] = [];

    // Check 1: config file exists and has a wallet
    const config = await loadConfig();
    const hasWallet = !!config?.wallet;
    checks.push({
      name: "Wallet configured",
      ok: hasWallet,
      message: hasWallet ? undefined : "No wallet found. Run `use-agently init` to create one.",
    });

    // Check 2: wallet is loadable (private key is valid)
    let walletOk = false;
    let walletMessage: string | undefined;
    if (hasWallet) {
      try {
        const wallet = loadWallet(config.wallet);
        walletOk = !!wallet;
      } catch (err) {
        walletMessage = err instanceof Error ? err.message : String(err);
      }
    } else {
      walletMessage = "Skipped (no wallet configured).";
    }
    checks.push({ name: "Wallet loadable", ok: walletOk, message: walletMessage });

    // Check 3: network reachable (RPC endpoint)
    let networkOk = false;
    let networkMessage: string | undefined;
    try {
      const client = createPublicClient({ chain: base, transport: http(options.rpc) });
      await client.getChainId();
      networkOk = true;
    } catch (err) {
      networkMessage = err instanceof Error ? err.message : String(err);
    }
    checks.push({ name: "Network reachable (Base RPC)", ok: networkOk, message: networkMessage });

    const allOk = checks.every((c) => c.ok);

    output(command, {
      ok: allOk,
      checks,
    });

    if (!allOk) {
      process.exit(1);
    }
  });
