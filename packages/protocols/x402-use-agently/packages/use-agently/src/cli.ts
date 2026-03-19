import { Command } from "commander";
import { initCommand } from "./commands/init";
import { whoamiCommand } from "./commands/whoami";
import { balanceCommand } from "./commands/balance";
import { agentsCommand } from "./commands/agents";
import { searchCommand } from "./commands/search";
import { viewCommand } from "./commands/view";
import { a2aCommand } from "./commands/a2a";
import { mcpCommand } from "./commands/mcp";
import { webCommand } from "./commands/web";
import { doctorCommand } from "./commands/doctor";
import { updateCommand } from "./commands/update";

import pkg from "../package.json" with { type: "json" };

export const cli = new Command();

cli
  .name("use-agently")
  .description(
    "Agently is the way AI coordinate and transact. The routing and settlement layer for your agent economy.",
  )
  .version(pkg.version)
  .option("-o, --output <format>", "Output format (tui, json)", process.stdout.isTTY ? "tui" : "json")
  .argument("[args...]")
  .action((args: string[]) => {
    if (args.length > 0) {
      // @ts-expect-error — unknownCommand() is an undocumented Commander.js method
      cli.unknownCommand();
      return;
    }
    cli.outputHelp();
  });

// Diagnostics
cli.addCommand(doctorCommand.helpGroup("Diagnostics"));
cli.addCommand(whoamiCommand.helpGroup("Diagnostics"));
cli.addCommand(balanceCommand.helpGroup("Diagnostics"));

// Discovery
cli.addCommand(agentsCommand.helpGroup("Discovery"));
cli.addCommand(searchCommand.helpGroup("Discovery"));
cli.addCommand(viewCommand.helpGroup("Discovery"));

// Protocols
cli.addCommand(a2aCommand.helpGroup("Protocols"));
cli.addCommand(mcpCommand.helpGroup("Protocols"));
cli.addCommand(webCommand.helpGroup("Protocols"));

// Lifecycle
cli.addCommand(initCommand.helpGroup("Lifecycle"));
cli.addCommand(updateCommand.helpGroup("Lifecycle"));

// Propagate showGlobalOptions to all subcommands added via addCommand(),
// which does not inherit configureHelp from the parent.
function enableGlobalOptionsInHelp(cmd: Command) {
  for (const sub of cmd.commands) {
    sub.configureHelp({ showGlobalOptions: true });
    enableGlobalOptionsInHelp(sub);
  }
}
enableGlobalOptionsInHelp(cli);
