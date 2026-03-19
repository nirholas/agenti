/**
 * Script to initialize payment registry for a wallet
 *
 * Usage: bun run scripts/init-registry.ts
 */

import * as readline from "node:readline";
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("=".repeat(60));
  console.log("x402a Payment Registry Initialization");
  console.log("=".repeat(60));
  console.log();

  // Get private key from user
  const privateKeyInput = await question("Enter your wallet's private key (will not be stored): ");

  if (!privateKeyInput) {
    console.error("ERROR: Private key is required");
    process.exit(1);
  }

  // Clean the private key
  const cleanKey = privateKeyInput.trim().startsWith("0x")
    ? privateKeyInput.trim().slice(2)
    : privateKeyInput.trim();

  try {
    // Create account from private key
    const privateKey = new Ed25519PrivateKey(cleanKey);
    const account = Account.fromPrivateKey({ privateKey });

    console.log();
    console.log("Wallet Address:", account.accountAddress.toString());
    console.log();

    // Initialize Aptos client
    const network = (process.env.NEXT_PUBLIC_APTOS_NETWORK as Network) || Network.TESTNET;
    const config = new AptosConfig({ network });
    const aptos = new Aptos(config);

    // Check if registry already exists
    const contractAddress =
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
      "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";

    console.log("Checking if registry already initialized...");
    try {
      await aptos.getAccountResource({
        accountAddress: account.accountAddress,
        resourceType: `${contractAddress}::x402_transfer::NonceRegistry`,
      });

      console.log("Registry already initialized! Nothing to do.");
      rl.close();
      return;
    } catch (error: any) {
      if (error.status === 404) {
        console.log("Registry not found, initializing now...");
      } else {
        throw error;
      }
    }

    // Build initialization transaction
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${contractAddress}::x402_transfer::initialize_registry`,
        functionArguments: [],
      },
    });

    // Sign and submit
    console.log("Submitting initialization transaction...");
    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    console.log("Waiting for confirmation...");
    await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    console.log();
    console.log("Registry initialized successfully!");
    console.log();
    console.log("Transaction:", committedTxn.hash);
    console.log(
      `Explorer: https://explorer.aptoslabs.com/txn/${committedTxn.hash}?network=${network}`
    );
    console.log();
    console.log("You can now make payments with this wallet!");
  } catch (error) {
    console.error();
    console.error("ERROR:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
