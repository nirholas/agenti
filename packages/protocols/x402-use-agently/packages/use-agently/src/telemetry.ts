import { Command } from "commander";
import { loadConfig } from "./config";
import pkg from "../package.json" with { type: "json" };

interface Session {
  version: string;
  os: string;
  arch: string;
  is_tty: boolean;
  output: "tui" | "json";
  wallet: string | null;
}

interface TelemetryEvent {
  name: string;
  args: Record<string, unknown>;
  session: Session;
}

const events: TelemetryEvent[] = [];

/** Build the full command path from a Commander command (e.g. "a2a send"). */
function getName(command: Command): string {
  const parts: string[] = [];
  let cmd: Command | null = command;
  while (cmd) {
    if (cmd.parent) {
      parts.unshift(cmd.name());
    }
    cmd = cmd.parent;
  }
  return parts.join(" ");
}

/** Extract args from a Commander command's parsed options. */
function getArgs(command: Command): Record<string, unknown> {
  const opts = command.opts();
  const args: Record<string, unknown> = {};
  const name = getName(command);

  // Agent URIs are public endpoints or on-chain IDs
  if (opts.uri) {
    args.uri = opts.uri;
  }

  // Pay flag
  if ("pay" in opts) {
    args.pay = !!opts.pay;
  }

  switch (name) {
    case "init":
      args.local = !!opts.local;
      args.regenerate = !!opts.regenerate;
      break;
    case "search":
      args.query = opts.query;
      args.protocol = opts.protocol;
      break;
    case "mcp call":
      args.tool = opts.tool;
      args.has_args = opts.args !== undefined;
      break;
    case "web get":
    case "web post":
    case "web put":
    case "web patch":
    case "web delete":
      args.has_headers = (opts.header?.length ?? 0) > 0;
      args.has_body = opts.data !== undefined || opts.dataRaw !== undefined;
      args.follow_redirects = !!opts.location;
      args.verbose = !!opts.verbose;
      break;
  }

  return args;
}

function getSession(command: Command): Session {
  return {
    version: pkg.version,
    os: process.platform,
    arch: process.arch,
    is_tty: !!process.stdout.isTTY,
    output: command.optsWithGlobals().output,
    wallet: null,
  };
}

/**
 * Install telemetry on the CLI command.
 * Loads config once in preAction for opt-out check and wallet context.
 * Must be called before `cli.parseAsync()`.
 */
export function installTelemetry(cli: Command): void {
  if (process.env.USE_AGENTLY_TELEMETRY === "0") return;

  let startTime: number | undefined;

  cli.hook("preAction", async () => {
    startTime = Date.now();
  });

  cli.hook("postAction", (_thisCommand, actionCommand) => {
    events.push({
      name: getName(actionCommand),
      args: { ...getArgs(actionCommand), duration: Date.now() - startTime! },
      session: getSession(actionCommand),
    });
  });
}

/**
 * Flush the single telemetry event to the server.
 * Fire-and-forget with a 3-second timeout — telemetry never blocks CLI exit.
 */
export async function flushTelemetry(): Promise<void> {
  if (events.length === 0) return;

  try {
    const body = JSON.stringify(events);
    events.length = 0; // Clear events immediately to avoid duplicates on next run if flush fails
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch("https://api.use-agently.com/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Telemetry must never crash the CLI
  }
}
