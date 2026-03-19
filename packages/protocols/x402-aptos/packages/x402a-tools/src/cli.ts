#!/usr/bin/env bun

/**
 * x402a CLI - Command line tools for managing x402a infrastructure
 */

import { checkBothAccounts } from "./commands/account";
import {
  checkFacilitatorBalance,
  fundFacilitator,
  generateFacilitator,
  verifyFacilitatorKey,
} from "./commands/facilitator";
import { initializeRegistry } from "./commands/registry";

const COMMANDS = {
  // Facilitator commands
  "facilitator:generate": {
    fn: generateFacilitator,
    desc: "Generate a new facilitator account",
  },
  "facilitator:balance": {
    fn: checkFacilitatorBalance,
    desc: "Check facilitator account balance",
  },
  "facilitator:fund": {
    fn: fundFacilitator,
    desc: "Fund facilitator account from testnet faucet",
  },
  "facilitator:verify": {
    fn: verifyFacilitatorKey,
    desc: "Verify private key matches configured address",
  },

  // Registry commands
  "registry:init": {
    fn: initializeRegistry,
    desc: "Initialize the nonce registry for facilitator",
  },

  // Account commands
  "account:check": {
    fn: async () => {
      const walletAddress =
        process.env.WALLET_ADDRESS ||
        "0x40e9006484aae0614729b5fa74806f1ae926e7275abf24b4196c3b2c1100f704";
      const facilitatorAddress =
        process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS ||
        "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";
      await checkBothAccounts(walletAddress, facilitatorAddress);
    },
    desc: "Check both wallet and facilitator balances",
  },
};

function printHelp() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
x402a CLI - Command Line Tools
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: x402a <command>

FACILITATOR COMMANDS:
  facilitator:generate    Generate a new facilitator account
  facilitator:balance     Check facilitator account balance
  facilitator:fund        Fund facilitator from testnet faucet
  facilitator:verify      Verify private key matches address

REGISTRY COMMANDS:
  registry:init           Initialize nonce registry

ACCOUNT COMMANDS:
  account:check           Check wallet and facilitator balances

OPTIONS:
  --help, -h              Show this help message

ENVIRONMENT VARIABLES:
  FACILITATOR_PRIVATE_KEY          Facilitator private key
  NEXT_PUBLIC_FACILITATOR_ADDRESS  Facilitator address
  NEXT_PUBLIC_CONTRACT_ADDRESS     Contract address
  WALLET_ADDRESS                   Your wallet address

EXAMPLES:
  x402a facilitator:generate
  x402a facilitator:balance
  x402a registry:init
  x402a account:check

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const cmd = COMMANDS[command as keyof typeof COMMANDS];

  if (!cmd) {
    console.error(`\n✗ Unknown command: ${command}\n`);
    console.error("Run 'x402a --help' to see available commands\n");
    process.exit(1);
  }

  try {
    await cmd.fn();
  } catch (error) {
    console.error("\n✗ Command failed:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("✗ Fatal error:", error);
  process.exit(1);
});
