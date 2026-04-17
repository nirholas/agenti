#!/usr/bin/env node
import { Command } from 'commander'
import { runGenerate } from './commands/generate.js'
import { runRegister } from './commands/register.js'
import { runDeploy } from './commands/deploy.js'

const program = new Command()

program
  .name('agenti')
  .description('Generate MCP servers from smart contract ABIs and deploy x402-gated APIs')
  .version('0.1.0')

program
  .command('generate <address>')
  .description('Fetch ABI for a contract and generate a ready-to-run MCP server')
  .option('--chain <chain>', 'EVM chain: mainnet, base, arbitrum, optimism, polygon, bsc', 'mainnet')
  .option('--out <dir>', 'Output directory for the generated server', './contract-mcp')
  .option('--name <name>', 'Human-readable contract name')
  .option('--rpc <url>', 'Custom RPC endpoint URL')
  .action(async (address: string, opts: { chain: string; out: string; name?: string; rpc?: string }) => {
    try {
      await runGenerate(address, opts)
    } catch (err) {
      console.error('Error:', (err as Error).message)
      process.exit(1)
    }
  })

program
  .command('register <url>')
  .description('Register an x402-gated API on x402scan')
  .option('--name <name>', 'Display name for the registered service')
  .option('--description <desc>', 'Short description of the service')
  .action(async (url: string, opts: { name?: string; description?: string }) => {
    try {
      await runRegister(url, opts)
    } catch (err) {
      console.error('Error:', (err as Error).message)
      process.exit(1)
    }
  })

program
  .command('deploy')
  .description('Deploy an x402-gated MCP server (coming soon)')
  .option('--port <port>', 'Port to listen on', '3000')
  .option('--register', 'Register on x402scan after startup')
  .option('--name <name>', 'Display name for the service')
  .action(async (opts: { port: string; register?: boolean; name?: string }) => {
    try {
      await runDeploy({
        port: parseInt(opts.port, 10),
        ...(opts.register !== undefined ? { register: opts.register } : {}),
        ...(opts.name !== undefined ? { name: opts.name } : {}),
      })
    } catch (err) {
      console.error('Error:', (err as Error).message)
      process.exit(1)
    }
  })

program.parse()
