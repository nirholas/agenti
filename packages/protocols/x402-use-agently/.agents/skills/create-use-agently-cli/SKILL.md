---
name: create-use-agently-cli
description: >-
  Create a new CLI command for the use-agently CLI.
  Use this skill when implementing a new command, subcommand, or protocol handler
  in the packages/use-agently package following the CLI design specification.
license: MIT
metadata:
  package: use-agently
  runtime: bun
  framework: commander
---

# Create a use-agently CLI Command

## When to Use

Use this skill when:

- Adding a new top-level command (e.g. `marketplace`, `wallets`, `update`)
- Adding a subcommand using the colon-separator pattern (e.g. `a2a:card`, `marketplace:agents`)
- Adding a shorthand alias for an existing command (e.g. `m` → `marketplace`)
- Implementing a new protocol handler (A2A, MCP, ERC-8004, HTTP)

## Command Taxonomy

Every command belongs to one of four categories. Place new commands in the correct category:

| Category               | Purpose                               | Examples                                        |
| ---------------------- | ------------------------------------- | ----------------------------------------------- |
| **Lifecycle & Health** | Setup, diagnostics, identity, balance | `doctor`, `whoami`, `balance`, `init`           |
| **Discovery**          | Browse the Agently marketplace        | `marketplace`, `marketplace:agents`             |
| **Operations**         | Config, wallets, updates              | `config`, `wallets`, `update`                   |
| **Protocols**          | Protocol invocations                  | `a2a`, `a2a:card`, `mcp`, `erc-8004`, `web:get` |

## Full Command Reference

```bash
# Lifecycle & Health
use-agently                        # Default: print available commands (same as --help)
use-agently help                   # Print available commands
use-agently doctor                 # Run environment and configuration health checks
use-agently whoami                 # Show current wallet type and address
use-agently balance                # Show on-chain wallet balance

# Discovery
use-agently marketplace            # List all agents/tools/skills on the marketplace
use-agently marketplace "query"    # Search the marketplace
use-agently marketplace:agents "query"
use-agently marketplace:tools "query"
use-agently marketplace:skills "query"
use-agently m "query"              # shorthand for marketplace
use-agently m:agents "query"
use-agently m:tools "query"
use-agently m:skills "query"

# Operations
use-agently init                   # Initialize a wallet and config
use-agently config                 # Show or edit current configuration
use-agently update                 # Update the CLI to the latest version
use-agently wallets                # List and manage configured wallets

# Protocols
use-agently erc-8004 "uri"         # Resolve an ERC-8004 agent URI
use-agently a2a "uri/url"          # Send a message to an agent via A2A protocol
use-agently a2a:card "uri/url"     # Fetch and display the A2A agent card
use-agently mcp "uri/url"          # Connect to an MCP server
use-agently web "url"              # HTTP GET (default method)
use-agently web:get "url"          # HTTP GET
use-agently web:put "url"          # HTTP PUT
```

## Instructions

### 1. Create the command file

Each command lives in its own file at `packages/use-agently/src/commands/<name>.ts`.

```ts
import { Command } from "commander";
import { loadConfig } from "../config.js";

export const myCommand = new Command("my-command")
  .description("One-line description of what this command does.")
  .argument("<uri>", "The agent URI or URL to target (e.g. echo-agent or https://use-agently.com/echo-agent/)")
  .option("--rpc <url>", "Custom RPC URL")
  .option("-o, --output <format>", "Output format (text, json)", "text")
  .addHelpText(
    "after",
    `
Examples:
  $ use-agently my-command echo-agent
  $ use-agently my-command https://use-agently.com/echo-agent/ --output json
  `,
  )
  .action(async (uri, options) => {
    const config = await loadConfig();
    // implementation
  });
```

### 2. Register the command in `cli.ts`

Open `packages/use-agently/src/cli.ts` and add the import and `addCommand` call:

```ts
import { myCommand } from "./commands/my-command.js";

// ...
cli.addCommand(myCommand);
```

### 3. Subcommands (colon-separator pattern)

Subcommands use the colon separator and are registered as separate Commander.js commands named `"parent:sub"`:

```ts
// packages/use-agently/src/commands/marketplace-agents.ts
import { Command } from "commander";

export const marketplaceAgentsCommand = new Command("marketplace:agents")
  .alias("m:agents")
  .description("Search agents on the Agently marketplace.")
  .argument("[query]", 'Search query (e.g. "code assistant")')
  .addHelpText(
    "after",
    `
Examples:
  $ use-agently marketplace:agents "code assistant"
  $ use-agently m:agents "translator"
  `,
  )
  .action(async (query, options) => {
    // implementation
  });
```

Register both the parent and subcommand:

```ts
cli.addCommand(marketplaceCommand);
cli.addCommand(marketplaceAgentsCommand);
```

### 4. Shorthand aliases

Add `.alias()` to the command definition for shorthands:

```ts
export const marketplaceCommand = new Command("marketplace").alias("m").description("Browse the Agently marketplace.");
```

### 5. Write tests

Create `packages/use-agently/src/commands/<name>.test.ts`. Follow the same pattern as existing tests:

```ts
import { describe, it, expect } from "bun:test";
import { myCommand } from "./my-command.js";

describe("my-command", () => {
  it("should ...", async () => {
    // test the exported functions directly
  });
});
```

Run the tests for the package:

```bash
bun run test --filter use-agently
```

## Design Rules (Required for Every Command)

1. **No TTY assumed** — never use interactive prompts. Every command must work in scripts, CI, and agent pipelines without a terminal.

2. **2-attempt error recovery** — error messages must include the expected type, shape, and an example so the caller can succeed on the second attempt. A third attempt required is a design failure.

   Good error message:

   ```
   Error: <agent-uri> must be a URL (e.g. https://use-agently.com/echo-agent/) or a short name resolvable on Agently (e.g. echo-agent).
   ```

3. **Self-describing** — `use-agently`, `-h`, `help`, and `--help` all print the same top-level help listing commands by category.

4. **Examples in `--help`** — use `.addHelpText("after", ...)` to include at least one concrete usage example for every command.

5. **Structured output** — use exit codes to signal success/failure. Support `--output json` emitting valid JSON to stdout.

6. **Colon subcommand naming** — register colon subcommands as `"command:subcommand"` in Commander.js. Never nest subcommands using `.command()` chaining.

## Common Patterns

### Loading config and wallet

```ts
import { loadConfig } from "../config.js";
import { loadWallet } from "../wallets/wallet.js";

const config = await loadConfig();
const wallet = await loadWallet(config);
```

### RPC URL fallback

```ts
.option("--rpc <url>", "Custom RPC URL")
.action(async (options) => {
  const config = await loadConfig();
  const rpcUrl = options.rpc ?? config.rpcUrl;
});
```

### JSON output

```ts
.action(async (options) => {
  const result = { address: wallet.address };
  if (options.output === "json") {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Address: ${result.address}`);
  }
});
```

### Error with recovery hint

```ts
if (!isValidUri(uri)) {
  console.error(
    `Error: <uri> must be a URL (e.g. https://use-agently.com/echo-agent/) or a short agent name (e.g. echo-agent).`,
  );
  process.exit(1);
}
```

## File Layout

```
packages/use-agently/
  src/
    cli.ts                        # Register all commands here
    commands/
      <name>.ts                   # One file per command
      <name>.test.ts              # Matching test file
    config.ts                     # Config load/save
    client.ts                     # x402 fetch + A2A client factory
    wallets/
      wallet.ts                   # Wallet interface + loadWallet()
      evm-private-key.ts          # EVM private key implementation
```

## Common Edge Cases

- **Colon in command name** — Commander.js accepts `"a2a:card"` as a command name. Do not use nested `.command()` chaining for subcommands.
- **Missing wallet** — catch errors from `loadWallet()` and print a recovery hint: `"Run 'use-agently init' to create a wallet."`.
- **No config file** — `loadConfig()` returns defaults when no config file exists; never throw on missing config.
- **Non-zero exit on failure** — always call `process.exit(1)` on errors so agent pipelines can detect failures.
