import {
  type Hex,
  type LocalAccount,
  type TransactionSerializable,
  type TypedDataDomain,
  hashDomain,
  hashStruct,
} from "viem";
import Eth from "@ledgerhq/hw-app-eth/lib-es/Eth";
import { type ChainInfo } from "@faremeter/types/evm";
import { type } from "arktype";
import { createTransport } from "./transport";
import type { LedgerEvmWallet, UserInterface } from "./types";

/**
 * Creates a Ledger hardware wallet interface for EVM chains.
 *
 * Connects to a Ledger device and returns a wallet that can sign
 * transactions and EIP-712 typed data.
 *
 * @param ui - User interface for displaying prompts and messages.
 * @param chain - EVM chain configuration.
 * @param derivationPath - BIP-44 derivation path (e.g., "m/44'/60'/0'/0/0").
 * @returns A Ledger EVM wallet interface.
 */
export async function createLedgerEvmWallet(
  ui: UserInterface,
  chain: ChainInfo,
  derivationPath: string,
): Promise<LedgerEvmWallet> {
  const transport = await createTransport();
  const eth = new Eth(transport);

  const { address } = await eth.getAddress(derivationPath);
  const formattedAddress = (
    address.startsWith("0x") ? address : `0x${address}`
  ).toLowerCase() as Hex;

  const ledgerAccount: LocalAccount = {
    address: formattedAddress,
    publicKey: formattedAddress,
    type: "local",
    source: "custom",

    signMessage: async ({ message }) => {
      let messageToSign: string;
      if (typeof message === "string") {
        messageToSign = Buffer.from(message).toString("hex");
      } else if (message && typeof message === "object" && "raw" in message) {
        const raw = message.raw;
        messageToSign =
          typeof raw === "string"
            ? raw.slice(2)
            : Buffer.from(raw).toString("hex");
      } else {
        messageToSign = Buffer.from(String(message)).toString("hex");
      }

      const result = await eth.signPersonalMessage(
        derivationPath,
        messageToSign,
      );
      const signature =
        `0x${result.r}${result.s}${result.v.toString(16).padStart(2, "0")}` as Hex;
      return signature;
    },

    signTransaction: async (transaction: TransactionSerializable) => {
      const toHex = (v: number | bigint | undefined, defaultValue?: string) =>
        v ? `0x${v.toString(16)}` : defaultValue;

      const tx = {
        to: transaction.to,
        value: toHex(transaction.value, "0x0"),
        data: transaction.data ?? "0x", // 0x is valid encoding for empty data in EVM
        nonce: toHex(transaction.nonce, "0x0"),
        gasLimit: toHex(transaction.gas, "0x5208"),
        gasPrice: toHex(transaction.gasPrice),
        maxFeePerGas: toHex(transaction.maxFeePerGas),
        maxPriorityFeePerGas: toHex(transaction.maxPriorityFeePerGas),
        chainId: chain.id,
      };

      const result = await eth.signTransaction(
        derivationPath,
        JSON.stringify(tx),
      );
      const signature = `0x${result.r}${result.s}${result.v}` as Hex;
      return signature;
    },

    signTypedData: async (parameters) => {
      const typedDataParams = type({
        "domain?": {
          "name?": "string",
          "version?": "string",
          "chainId?": "number",
          "verifyingContract?": "string",
          "salt?": "string",
        },
        types: "object",
        primaryType: "string",
        message: "object",
      });

      type TypeDefinition = Record<string, { name: string; type: string }[]>;

      const validated = typedDataParams.assert(parameters);
      const { domain, types, primaryType, message } = validated as {
        domain?: TypedDataDomain;
        types: TypeDefinition;
        primaryType: string;
        message: Record<string, unknown>;
      };

      try {
        // Use EIP-712 hashed message approach. This calculates the domain
        // separator and message hash separately and sends them to the Ledger
        // for signing.

        // Build types with EIP712Domain
        const typesWithDomain: TypeDefinition = {
          EIP712Domain: [
            ...(domain?.name ? [{ name: "name", type: "string" }] : []),
            ...(domain?.version ? [{ name: "version", type: "string" }] : []),
            ...(domain?.chainId ? [{ name: "chainId", type: "uint256" }] : []),
            ...(domain?.verifyingContract
              ? [{ name: "verifyingContract", type: "address" }]
              : []),
          ],
          ...types,
        };

        // Calculate hashes using viem
        const domainSeparator = hashDomain({
          domain: domain ?? {},
          types: typesWithDomain,
        });

        // types without domain for message hash
        const messageHash = hashStruct({
          data: message,
          primaryType,
          types,
        });

        ui.message("\nEIP-712 hashes calculated:");
        ui.message(`  Domain separator: ${domainSeparator}`);
        ui.message(`  Message hash: ${messageHash}`);
        ui.message(`\nPlease approve the transaction on your Ledger device...`);

        const result = await eth.signEIP712HashedMessage(
          derivationPath,
          domainSeparator.slice(2),
          messageHash.slice(2),
        );

        const signature =
          `0x${result.r}${result.s}${result.v.toString(16).padStart(2, "0")}` as Hex;
        return signature;
      } catch (error) {
        ui.message(`EIP-712 signing failed: ${error}`);
        throw error;
      }
    },
  };

  return {
    chain,
    address: formattedAddress,
    signTransaction: async (tx: TransactionSerializable) => {
      return await ledgerAccount.signTransaction(tx);
    },
    signTypedData: async (params) => {
      return await ledgerAccount.signTypedData(params);
    },
    disconnect: async () => {
      await transport.close();
    },
  };
}
