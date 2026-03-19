import Eth from "@ledgerhq/hw-app-eth/lib-es/Eth";
import Solana from "@ledgerhq/hw-app-solana/lib-es/Solana";
import { PublicKey } from "@solana/web3.js";
import { createTransport, translateLedgerError } from "./transport";
import type { UserInterface } from "./types";

function evmDerivationPath(index: number) {
  return `m/44'/60'/${index}'/0/0`;
}

function solanaDerivationPath(index: number) {
  return `44'/501'/${index}'`;
}

/**
 * Interactively selects a Ledger account from the device.
 *
 * Enumerates accounts on the connected Ledger device and prompts the
 * user to select one via the provided user interface.
 *
 * @param ui - User interface for displaying accounts and receiving selection.
 * @param type - Account type to enumerate ("evm" or "solana").
 * @param numAccounts - Number of accounts to scan (default: 5).
 * @returns The selected account's derivation path and address, or null if selection cancelled.
 */
export async function selectLedgerAccount(
  ui: UserInterface,
  type: "evm" | "solana",
  numAccounts = 5,
): Promise<{ path: string; address: string } | null> {
  const isEvm = type === "evm";
  ui.message(
    `\nScanning first ${numAccounts} ${isEvm ? "Ethereum" : "Solana"} accounts...`,
  );

  const accounts: { path: string; address: string }[] = [];
  const transport = await createTransport();

  try {
    if (isEvm) {
      const eth = new Eth(transport);
      for (let i = 0; i < numAccounts; i++) {
        const path = evmDerivationPath(i);
        let result;
        try {
          result = await eth.getAddress(path, false);
        } catch (error) {
          throw translateLedgerError(error);
        }
        const address = result.address;
        const normalizedAddress = address.startsWith("0x")
          ? address
          : `0x${address}`;
        accounts.push({ path, address: normalizedAddress });
        ui.message(`${i + 1}. ${normalizedAddress}`);
      }
    } else {
      const solana = new Solana(transport);
      for (let i = 0; i < numAccounts; i++) {
        const path = solanaDerivationPath(i);
        let result;
        try {
          result = await solana.getAddress(path, false);
        } catch (error) {
          throw translateLedgerError(error);
        }
        const publicKey = new PublicKey(result.address);
        const address = publicKey.toBase58();
        accounts.push({ path, address });
        ui.message(`${i + 1}. ${address}`);
      }
    }
  } finally {
    await transport.close();
  }

  const selection = await ui.question(`\nSelect account (1-${numAccounts}): `);

  const index = parseInt(selection) - 1;

  if (index < 0 || index >= accounts.length) {
    ui.message("Invalid selection");
    return null;
  }

  return accounts[index] ?? null;
}
