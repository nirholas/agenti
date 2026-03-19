import { logger } from "./logger";
import type Transport from "@ledgerhq/hw-transport";

const LEDGER_ERRORS: Record<string, string> = {
  "0x5515": "Ledger is locked. Please unlock your device.",
  "0x6511": "Please unlock your Ledger and open the correct app.",
  "0x6d00": "Wrong app open. Please open the correct app.",
  "0x6d02": "No app open. Please open the correct app on your Ledger.",
  "0x6e00": "Wrong app open. Please open the correct app on your Ledger.",
  "0x6985": "Transaction rejected on Ledger device.",
  "0x6a80":
    "Incorrect data. Please make sure the correct app is open on your Ledger.",
  "0x6a83": "Wrong app open. Please open the correct app on your Ledger.",
};

export function translateLedgerError(error: unknown): Error {
  const message = String(error instanceof Error ? error.message : error);

  const hexMatch = /0x[0-9a-fA-F]{4}/.exec(message);

  if (hexMatch && LEDGER_ERRORS[hexMatch[0]]) {
    return new Error(LEDGER_ERRORS[hexMatch[0]]);
  }

  // Check for common connection errors
  if (message.includes("NoDevice")) {
    return new Error(
      "No Ledger device found. Please connect your Ledger and unlock it.",
    );
  }
  if (message.includes("Device busy")) {
    return new Error("Ledger is in use by another app. Close Ledger Live.");
  }

  return error instanceof Error ? error : new Error(message);
}

export async function createTransport(maxRetries = 3): Promise<Transport> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const isBrowser =
        typeof globalThis !== "undefined" && "window" in globalThis;

      if (isBrowser) {
        const { default: TransportWebUSB } = await import(
          "@ledgerhq/hw-transport-webusb"
        );
        return await TransportWebUSB.create();
      } else {
        const mod = await import("@ledgerhq/hw-transport-node-hid");
        const TransportNodeHid =
          (
            mod as unknown as {
              default: { open: (descriptor: string) => Promise<Transport> };
            }
          ).default || mod;
        return await TransportNodeHid.open("");
      }
    } catch (error) {
      const translatedError = translateLedgerError(error);
      lastError = translatedError;

      // Retry on generic USB errors
      const errorMessage = translatedError.message;
      if (
        i < maxRetries - 1 &&
        (errorMessage.includes("USB") || errorMessage.includes("device"))
      ) {
        logger.warning(`USB connection attempt ${i + 1} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Failed to connect to Ledger device");
}
