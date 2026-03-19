import { Command } from "commander";
import boxen from "boxen";
import { formatUnits } from "viem";
import {
  type TransactionMode,
  DryRunTransaction,
  PayTransaction,
  DryRunPaymentRequired,
  getChainConfigByNetwork,
  loadWallet,
  listMcpTools,
  callMcpTool,
} from "@use-agently/sdk";
import { getConfigOrThrow } from "../config";
import { defaultClient, clientFetch, handleDryRunError } from "../client";
import pkg from "../../package.json" with { type: "json" };
import { output, outputCollection } from "../output";

async function resolveTransactionMode(pay?: boolean): Promise<TransactionMode> {
  if (pay) {
    const config = await getConfigOrThrow();
    const wallet = loadWallet(config.wallet);
    return PayTransaction(wallet);
  }
  return DryRunTransaction;
}

export const mcpCommand = new Command("mcp")
  .description("Connect to an MCP server and list or call tools")
  .action(function () {
    (this as Command).outputHelp();
  });

const mcpToolsCommand = new Command("tools")
  .description("List available tools on an MCP server")
  .requiredOption("-u, --uri <value>", "MCP server URL or CAIP-19 ID")
  .showHelpAfterError(true)
  .addHelpText(
    "after",
    "\nExamples:\n  use-agently mcp tools --uri https://example.com/mcp\n  use-agently mcp tools --uri eip155:8453/erc8004:0x1234/1",
  )
  .action(async (options: { uri: string }, command: Command) => {
    const tools = await listMcpTools(defaultClient, options.uri, {
      clientInfo: { name: "use-agently", version: pkg.version },
      fetchImpl: clientFetch,
    });
    outputCollection(command, tools);
  });

const mcpCallCommand = new Command("call")
  .description("Call a specific tool on an MCP server")
  .requiredOption("-u, --uri <value>", "MCP server URL or CAIP-19 ID")
  .requiredOption("--tool <name>", "Tool name to call")
  .option("--args <json>", "JSON arguments to pass to the tool")
  .option("--pay", "Authorize payment if the tool requires it (default: dry-run, shows cost only)")
  .showHelpAfterError(true)
  .addHelpText(
    "after",
    '\nExamples:\n  use-agently mcp call --uri https://example.com/mcp --tool echo --args \'{"message":"hello"}\'\n  use-agently mcp call --uri https://example.com/mcp --tool paid-tool --args \'{"message":"hello"}\' --pay',
  )
  .action(async (options: { uri: string; tool: string; args?: string; pay?: boolean }, command: Command) => {
    const uri = options.uri;
    const tool = options.tool;
    let args: Record<string, unknown> = {};
    if (options.args !== undefined) {
      try {
        args = JSON.parse(options.args);
      } catch {
        throw new Error(
          `Invalid JSON in --args: ${options.args}\nExpected a JSON object, e.g. --args '{"message":"hello"}'`,
        );
      }
    }
    const transaction = await resolveTransactionMode(options.pay);

    try {
      const result = await callMcpTool(defaultClient, uri, tool, args, {
        transaction,
        clientInfo: { name: "use-agently", version: pkg.version },
        fetchImpl: clientFetch,
      });

      const content = result.content as Array<{ type: string; text?: string }>;

      // Handle error responses
      if (result.isError) {
        const text = content?.find((c) => c.type === "text")?.text;
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed?.error && Array.isArray(parsed?.accepts) && parsed.accepts.length > 0) {
              let message: string;
              if (parsed.error === "insufficient_funds") {
                const req = parsed.accepts[0];
                let amountStr = "unknown amount";
                try {
                  const { usdcDecimals } = getChainConfigByNetwork(req.network);
                  const raw = formatUnits(BigInt(req.amount), usdcDecimals);
                  const formatted = raw.includes(".") ? raw.replace(/\.?0+$/, "") : raw;
                  amountStr = `$${formatted} USDC on ${req.network}`;
                } catch {
                  amountStr = `${req.amount} (raw units)`;
                }
                message = `Insufficient funds to pay for this tool.\nRequired: ${amountStr}\nEnsure your wallet has sufficient USDC balance and try again.`;
              } else {
                message = `Payment error: ${parsed.error}`;
              }
              if (process.stderr.isTTY) {
                console.error(
                  boxen(message, {
                    title: parsed.error === "insufficient_funds" ? "Insufficient Funds" : "Payment Error",
                    titleAlignment: "center",
                    borderColor: "red",
                    padding: 1,
                  }),
                );
              } else {
                const title = parsed.error === "insufficient_funds" ? "Insufficient Funds" : "Payment Error";
                console.error(`${title}: ${message}`);
              }
              process.exit(1);
            }
          } catch {
            // Not JSON — fall through to print as-is
          }
          console.error(text);
        } else {
          console.error("Tool call returned an error with no text content.");
        }
        process.exit(1);
      }

      // Success: extract text entries when all content is text, otherwise output the full result
      if (content?.every((c) => c.type === "text" && c.text)) {
        const texts = content.map((c) => c.text!);
        output(command, texts.length === 1 ? texts[0] : texts);
      } else {
        output(command, result);
      }
    } catch (err) {
      if (err instanceof DryRunPaymentRequired) handleDryRunError(err);
      throw err;
    }
  });

mcpCommand.addCommand(mcpToolsCommand);
mcpCommand.addCommand(mcpCallCommand);
