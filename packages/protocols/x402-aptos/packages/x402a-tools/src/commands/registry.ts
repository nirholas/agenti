/**
 * Registry initialization command
 */

import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

export async function initializeRegistry(): Promise<void> {
  const privateKeyHex =
    process.env.FACILITATOR_PRIVATE_KEY ||
    "0x8d387425c2f440879bbeb1a20b075ed0c4b36b5dcc9e39a6cf6ff38dfc2c6d2b";
  const contractAddress =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";

  const cleanKey = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKey = new Ed25519PrivateKey(cleanKey);
  const account = Account.fromPrivateKey({ privateKey });

  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  console.log("Initializing x402a registry for facilitator...\n");
  console.log("Account:", account.accountAddress.toString());
  console.log("Contract:", contractAddress);

  try {
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${contractAddress}::x402_transfer::initialize_registry`,
        functionArguments: [],
      },
    });

    console.log("\nSubmitting transaction...");

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    console.log("Waiting for confirmation...");

    const executedTransaction = await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    if (executedTransaction.success) {
      console.log("\n✓ Registry initialized successfully!");
      console.log("\nTransaction hash:", committedTxn.hash);
      console.log(
        "View on explorer: https://explorer.aptoslabs.com/txn/" +
          committedTxn.hash +
          "?network=testnet"
      );
      console.log("\nFacilitator is now ready to process payments!");
    } else {
      console.error("\n✗ ERROR: Transaction failed:", executedTransaction.vm_status);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n✗ ERROR:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}
