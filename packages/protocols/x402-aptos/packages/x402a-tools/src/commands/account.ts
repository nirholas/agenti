/**
 * Account management commands
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

async function checkBalance(address: string, label: string): Promise<boolean> {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  try {
    const resources = await aptos.getAccountResources({ accountAddress: address });
    const coinResource = resources.find(
      (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
    );

    if (coinResource) {
      const balance = (coinResource.data as { coin: { value: string } }).coin.value;
      const aptBalance = Number(balance) / 100000000;
      console.log(`${label}: ${aptBalance} APT (${balance} octas)`);
      return true;
    } else {
      console.log(`WARNING: ${label}: No CoinStore found (needs funding)`);
      return false;
    }
  } catch (_error) {
    console.log(`ERROR: ${label}: Account not found on-chain`);
    return false;
  }
}

export async function checkBothAccounts(
  walletAddress: string,
  facilitatorAddress: string
): Promise<void> {
  console.log("Checking account balances on testnet...\n");

  const wallet = await checkBalance(walletAddress, "Main Wallet    ");
  const facilitator = await checkBalance(facilitatorAddress, "Facilitator    ");

  console.log("\nSummary:");
  if (wallet && facilitator) {
    console.log("✓ Both accounts are funded and ready!");
    console.log("\nYou can now run the examples:");
    console.log("   cd examples/nextjs-app-router");
    console.log("   bun run dev");
  } else {
    console.log("✗ WARNING: One or more accounts need funding");
    console.log("\nFund accounts at: https://faucet.testnet.aptoslabs.com");
    if (!wallet) {
      console.log(`   - Main Wallet: ${walletAddress}`);
    }
    if (!facilitator) {
      console.log(`   - Facilitator: ${facilitatorAddress}`);
    }
  }
}
