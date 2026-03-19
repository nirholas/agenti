import type { Command } from "commander"

import { clearApiUrl, getStatus, initConfig, setAgent, setApiUrl } from "../config.ts"

/**
 * Register the config subcommand with init, set-agent, and status
 */
export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage ampersend configuration")

  config
    .command("init")
    .description("Initialize configuration with a new agent key")
    .action(() => {
      const result = initConfig()
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })

  config
    .command("set-agent")
    .description("Set the agent account address to complete configuration")
    .argument("<address>", "Agent account address (0x...)")
    .action((address: string) => {
      const result = setAgent(address)
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })

  config
    .command("set-api")
    .description("Set API URL (for non-production environments)")
    .argument("<url>", "API URL (e.g., https://api.staging.ampersend.ai)")
    .action((url: string) => {
      const result = setApiUrl(url)
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })

  config
    .command("clear-api")
    .description("Clear API URL (revert to production)")
    .action(() => {
      const result = clearApiUrl()
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })

  config
    .command("status")
    .description("Show current configuration status")
    .option("-v, --verbose", "Include raw addresses in output", false)
    .action((options: { verbose: boolean }) => {
      const result = getStatus({ verbose: options.verbose })
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })
}
