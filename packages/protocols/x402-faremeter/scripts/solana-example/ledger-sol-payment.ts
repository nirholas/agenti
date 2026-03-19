import {
  createLedgerSolanaWallet,
  selectLedgerAccount,
  createReadlineInterface,
} from "@faremeter/wallet-ledger";
import { createPaymentHandler } from "@faremeter/x-solana-settlement";
import { wrap as wrapFetch } from "@faremeter/fetch";
import { client } from "@faremeter/types";
import { normalizeNetworkId } from "@faremeter/info";

// Parse command line arguments
const args = process.argv.slice(2);
const port = args[0] ?? "3000";
const endpoint = args[1] ?? "protected";
const url = `http://localhost:${port}/${endpoint}`;

const ui = await createReadlineInterface(process);

ui.message("Connecting to Ledger for Solana payments...");
ui.message("\nRequired Ledger Settings:");
ui.message("1. Open the Solana app on your Ledger");
ui.message("2. When prompted, approve the transaction on your Ledger");

const selected = await selectLedgerAccount(ui, "solana", 5);

if (!selected) {
  process.exit(0);
}

ui.message(`\nUsing account: ${selected.address}`);

const ledgerWallet = await createLedgerSolanaWallet("devnet", selected.path);

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [
    client.adaptPaymentHandlerV1ToV2(
      createPaymentHandler(ledgerWallet),
      normalizeNetworkId,
    ),
  ],
});

ui.message(`\nMaking payment request to ${url}...`);
ui.message("When prompted, confirm the transaction on your Ledger...");

let req;
try {
  req = await fetchWithPayer(url);
} catch (fetchError) {
  await ledgerWallet.disconnect();
  const errorMessage = (fetchError as Error).message;
  ui.message(`\nError: ${errorMessage}`);
  if (
    errorMessage.includes("fetch failed") ??
    errorMessage.includes("ECONNREFUSED")
  ) {
    ui.message(`Are you sure the Faremeter server is running on port ${port}?`);
  }
  process.exit(1);
}

ui.message(`Status: ${req.status}`);
ui.message(`Headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);
const response = await req.json();
ui.message(`Response: ${JSON.stringify(response)}`);

await ledgerWallet.disconnect();
ui.message(`\nSuccess! Ledger payment completed.`);
await ui.close();
