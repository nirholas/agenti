/**
 * Facilitator account management commands
 */

import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

export async function generateFacilitator(): Promise<void> {
  console.log("Generating new Aptos facilitator account...\n");

  const account = Account.generate();
  const privateKey = account.privateKey.toString();
  const address = account.accountAddress.toString();

  console.log("Account generated successfully!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("FACILITATOR ACCOUNT DETAILS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Address:     ${address}`);
  console.log(`Private Key: ${privateKey}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("IMPORTANT SECURITY NOTES:");
  console.log("   - NEVER commit this private key to git");
  console.log("   - NEVER share this private key with anyone");
  console.log("   - This key has spending power - keep it secret!");
  console.log("   - Add it to .env.local (already in .gitignore)\n");

  console.log("NEXT STEPS:\n");
  console.log("1. Fund this account with testnet APT:");
  console.log(`   - Visit: https://aptos.dev/en/network/faucet`);
  console.log(`   - Enter address: ${address}`);
  console.log(`   - Request testnet APT\n`);

  console.log("2. Add to .env.local:");
  console.log(`   FACILITATOR_PRIVATE_KEY=${privateKey}\n`);

  console.log("3. Restart your Next.js server:");
  console.log("   bun run dev\n");

  // Try to fund the account
  console.log("Attempting to fund account from faucet...");
  try {
    const config = new AptosConfig({ network: Network.TESTNET });
    const aptos = new Aptos(config);

    await aptos.fundAccount({
      accountAddress: address,
      amount: 100000000, // 1 APT
    });

    console.log("Account funded with 1 APT from testnet faucet!");
    console.log(
      `   Check balance: https://explorer.aptoslabs.com/account/${address}?network=testnet\n`
    );
  } catch (error) {
    console.log("WARNING: Auto-funding failed - please fund manually from faucet");
    console.log(`   Error: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("READY TO TEST REAL TRANSACTIONS!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

export async function checkFacilitatorBalance(): Promise<void> {
  const privateKeyHex = process.env.FACILITATOR_PRIVATE_KEY;

  if (!privateKeyHex) {
    console.error("ERROR: FACILITATOR_PRIVATE_KEY not set in environment");
    process.exit(1);
  }

  const cleanKey = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKey = new Ed25519PrivateKey(cleanKey);
  const account = Account.fromPrivateKey({ privateKey });
  const address = account.accountAddress.toString();

  console.log("Checking facilitator account...\n");
  console.log(`Address: ${address}`);

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

      console.log(`Balance: ${balance} octas (${aptBalance} APT)`);

      if (aptBalance > 0) {
        console.log("Account is funded and ready!");
      } else {
        console.log("WARNING: Account has zero balance - needs funding");
        console.log(`\nFund at: https://aptos.dev/en/network/faucet`);
      }
    } else {
      console.log("WARNING: Account not found on-chain - needs to be funded first");
      console.log(`\nFund at: https://aptos.dev/en/network/faucet`);
    }
  } catch (error) {
    console.log("WARNING: Account not found on-chain - needs to be funded first");
    console.log(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.log(`\nFund at: https://aptos.dev/en/network/faucet`);
  }

  console.log(
    `\nView on explorer: https://explorer.aptoslabs.com/account/${address}?network=testnet`
  );
}

export async function fundFacilitator(): Promise<void> {
  const privateKeyHex = process.env.FACILITATOR_PRIVATE_KEY;

  if (!privateKeyHex) {
    console.error("ERROR: FACILITATOR_PRIVATE_KEY not set in environment");
    process.exit(1);
  }

  const cleanKey = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKey = new Ed25519PrivateKey(cleanKey);
  const account = Account.fromPrivateKey({ privateKey });
  const address = account.accountAddress.toString();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("FUNDING FACILITATOR ACCOUNT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`Facilitator Address: ${address}\n`);

  console.log(`Requesting testnet APT from faucet...`);

  try {
    const config = new AptosConfig({ network: Network.TESTNET });
    const aptos = new Aptos(config);

    const txn = await aptos.fundAccount({
      accountAddress: address,
      amount: 100000000, // 1 APT in octas
    });

    console.log("Funded successfully!");
    console.log("Transaction hash:", txn);

    console.log("\nFacilitator funded! Ready to submit real transactions!");
    console.log(
      `View on explorer: https://explorer.aptoslabs.com/account/${address}?network=testnet`
    );
  } catch (error) {
    console.log(
      `Faucet request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    console.log("\nAuto-funding failed. Please fund manually:");
    console.log("1. Visit: https://aptos.dev/en/network/faucet");
    console.log(`2. Enter address: ${address}`);
    console.log("3. Request testnet APT");
    console.log(
      `4. Verify on explorer: https://explorer.aptoslabs.com/account/${address}?network=testnet`
    );
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

export async function verifyFacilitatorKey(): Promise<void> {
  const privateKeyHex = process.env.FACILITATOR_PRIVATE_KEY;
  const configuredAddress = process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS;

  if (!privateKeyHex) {
    console.error("ERROR: FACILITATOR_PRIVATE_KEY not set");
    process.exit(1);
  }

  const cleanKey = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKey = new Ed25519PrivateKey(cleanKey);
  const account = Account.fromPrivateKey({ privateKey });
  const derivedAddress = account.accountAddress.toString();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("FACILITATOR KEY VERIFICATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nPrivate Key: ${privateKeyHex.slice(0, 10)}...${privateKeyHex.slice(-8)}`);
  console.log(`Derived Address: ${derivedAddress}`);
  console.log(`Configured Address: ${configuredAddress || "NOT SET"}`);

  if (derivedAddress.toLowerCase() === configuredAddress?.toLowerCase()) {
    console.log("\n✓ Addresses match!");
  } else {
    console.log("\n✗ WARNING: MISMATCH - Private key does not match configured address!");
  }

  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  // Check derived address
  console.log(`\nDerived Address: ${derivedAddress}`);
  try {
    const resources = await aptos.getAccountResources({ accountAddress: derivedAddress });
    const coinResource = resources.find(
      (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
    );

    if (coinResource) {
      const balance = (coinResource.data as { coin: { value: string } }).coin.value;
      const aptBalance = Number(balance) / 100000000;
      console.log(`   Balance: ${balance} octas (${aptBalance} APT)`);
    } else {
      console.log(`   WARNING: No balance found`);
    }
  } catch (_error) {
    console.log(`   WARNING: Account not found on-chain`);
  }

  // Check configured address if different
  if (configuredAddress && derivedAddress.toLowerCase() !== configuredAddress.toLowerCase()) {
    console.log(`\nConfigured Address: ${configuredAddress}`);
    try {
      const resources = await aptos.getAccountResources({ accountAddress: configuredAddress });
      const coinResource = resources.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      if (coinResource) {
        const balance = (coinResource.data as { coin: { value: string } }).coin.value;
        const aptBalance = Number(balance) / 100000000;
        console.log(`   Balance: ${balance} octas (${aptBalance} APT)`);
      } else {
        console.log(`   WARNING: No balance found`);
      }
    } catch (_error) {
      console.log(`   WARNING: Account not found on-chain`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
