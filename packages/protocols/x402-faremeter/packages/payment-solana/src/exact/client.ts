import type { x402PaymentRequirements } from "@faremeter/types/x402v2";
import { isValidationError, throwValidationError } from "@faremeter/types";
import type {
  PaymentExecer,
  PaymentHandler,
  RequestContext,
} from "@faremeter/types/client";
import type { SolanaCAIP2Network } from "@faremeter/info/solana";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  getBase64EncodedWireTransaction,
  type SignaturesMap,
  type TransactionMessageBytes,
} from "@solana/transactions";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
} from "@solana/web3.js";
import { PaymentRequirementsExtra } from "./facilitator";
import { generateMatcher } from "./common";
import { logger } from "./logger";

export type Wallet = {
  network: string | SolanaCAIP2Network;
  publicKey: PublicKey;
  buildTransaction?: (
    instructions: TransactionInstruction[],
    recentBlockHash: string,
  ) => Promise<VersionedTransaction>;
  partiallySignTransaction?: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  updateTransaction?: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  sendTransaction?: (tx: VersionedTransaction) => Promise<string>;
};

interface GetAssociatedTokenAddressSyncOptions {
  allowOwnerOffCurve?: boolean;
  programId?: PublicKey;
  associatedTokenProgramId?: PublicKey;
}

function generateGetAssociatedTokenAddressSyncRest(
  tokenConfig: GetAssociatedTokenAddressSyncOptions,
) {
  const { allowOwnerOffCurve, programId, associatedTokenProgramId } =
    tokenConfig;

  // NOTE: These map to the trailing default args of
  // getAssociatedTokenAddressSync, so order matters. If things are
  // refactored, they should be updated to match the reality of the
  // implementation.

  return [allowOwnerOffCurve, programId, associatedTokenProgramId] as const;
}

const PaymentMode = {
  ToSpec: "toSpec",
  SettlementAccount: "settlementAccount",
} as const;

type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

async function extractMetadata(args: {
  connection: Connection | undefined;
  mint: PublicKey;
  requirements: x402PaymentRequirements;
  options: CreatePaymentHandlerOptions | undefined;
  wallet: Wallet;
}) {
  const { connection, mint, requirements, wallet, options } = args;

  const extra = PaymentRequirementsExtra(requirements.extra);

  if (isValidationError(extra)) {
    throwValidationError("couldn't validate requirements extra field", extra);
  }

  let recentBlockhash: string;
  if (extra.recentBlockhash !== undefined) {
    recentBlockhash = extra.recentBlockhash;
  } else if (connection !== undefined) {
    recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  } else {
    throw new Error("couldn't get the latest Solana network block hash");
  }

  let decimals: number;

  if (extra.decimals !== undefined) {
    decimals = extra.decimals;
  } else if (connection !== undefined) {
    const mintInfo = await getMint(connection, mint);
    decimals = mintInfo.decimals;
  } else {
    throw new Error("couldn't get the decimal information for the mint");
  }

  const payerKey = new PublicKey(extra.feePayer);
  const payTo = new PublicKey(requirements.payTo);
  const amount = Number(requirements.amount);
  let paymentMode: PaymentMode = PaymentMode.ToSpec;

  if (
    options?.features?.enableSettlementAccounts &&
    extra.features?.xSettlementAccountSupported &&
    wallet.sendTransaction
  ) {
    paymentMode = PaymentMode.SettlementAccount;
  }

  return {
    recentBlockhash,
    decimals,
    payTo,
    amount,
    payerKey,
    paymentMode,
  };
}

interface CreatePaymentHandlerOptions {
  token?: GetAssociatedTokenAddressSyncOptions;
  settlementRentDestination?: string;
  features?: {
    enableSettlementAccounts?: boolean;
  };
}

/**
 * Creates a payment handler for the Solana exact payment scheme.
 *
 * The handler builds SPL token transfer transactions that can be signed
 * and submitted by the client to fulfill x402 payment requirements.
 *
 * @param wallet - Wallet providing signing capabilities
 * @param mint - SPL token mint public key
 * @param connection - Optional Solana connection for fetching blockhash and mint info
 * @param options - Optional configuration for token address and features
 * @returns A PaymentHandler function for use with the x402 client
 */
export function createPaymentHandler(
  wallet: Wallet,
  mint: PublicKey,
  connection?: Connection,
  options?: CreatePaymentHandlerOptions,
): PaymentHandler {
  const getAssociatedTokenAddressSyncRest =
    generateGetAssociatedTokenAddressSyncRest(options?.token ?? {});

  let hasWarnedAboutDeprecation = false;

  const signTransaction = async (tx: VersionedTransaction) => {
    if (wallet.partiallySignTransaction) {
      return wallet.partiallySignTransaction(tx);
    }
    if (wallet.updateTransaction) {
      if (!hasWarnedAboutDeprecation) {
        logger.warning(
          "wallet.partiallySignTransaction is not available, falling back to updateTransaction",
        );
        hasWarnedAboutDeprecation = true;
      }
      return wallet.updateTransaction(tx);
    }
    return tx;
  };

  const { isMatchingRequirement } = generateMatcher(
    wallet.network,
    mint ? mint.toBase58() : "sol",
  );

  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecer[]> => {
    const compatibleRequirements = accepts.filter(isMatchingRequirement);
    const res = compatibleRequirements.map((requirements) => {
      const exec = async () => {
        const {
          recentBlockhash,
          decimals,
          payTo,
          amount,
          payerKey,
          paymentMode,
        } = await extractMetadata({
          connection,
          mint,
          requirements,
          wallet,
          options,
        });

        const instructions = [
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 50_000,
          }),
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1,
          }),
        ];

        const sourceAccount = getAssociatedTokenAddressSync(
          mint,
          wallet.publicKey,
          ...getAssociatedTokenAddressSyncRest,
        );

        switch (paymentMode) {
          case PaymentMode.ToSpec: {
            const receiverAccount = getAssociatedTokenAddressSync(
              mint,
              payTo,
              ...getAssociatedTokenAddressSyncRest,
            );

            instructions.push(
              createTransferCheckedInstruction(
                sourceAccount,
                mint,
                receiverAccount,
                wallet.publicKey,
                amount,
                decimals,
              ),
            );

            let tx: VersionedTransaction;

            if (wallet.buildTransaction) {
              tx = await wallet.buildTransaction(instructions, recentBlockhash);
            } else {
              const message = new TransactionMessage({
                instructions,
                payerKey,
                recentBlockhash,
              }).compileToV0Message();

              tx = new VersionedTransaction(message);
            }

            tx = await signTransaction(tx);

            const base64EncodedWireTransaction =
              getBase64EncodedWireTransaction({
                messageBytes:
                  tx.message.serialize() as unknown as TransactionMessageBytes,
                signatures: tx.signatures as unknown as SignaturesMap,
              });

            const payload = {
              transaction: base64EncodedWireTransaction,
            };

            return { payload };
          }

          case PaymentMode.SettlementAccount: {
            const settleKeypair = Keypair.generate();
            const settleATA = getAssociatedTokenAddressSync(
              mint,
              settleKeypair.publicKey,
              ...getAssociatedTokenAddressSyncRest,
            );
            instructions.push(
              createAssociatedTokenAccountIdempotentInstruction(
                wallet.publicKey,
                settleATA,
                settleKeypair.publicKey,
                mint,
              ),
              createTransferCheckedInstruction(
                sourceAccount,
                mint,
                settleATA,
                wallet.publicKey,
                amount,
                decimals,
              ),
            );

            let tx: VersionedTransaction;

            if (wallet.buildTransaction) {
              tx = await wallet.buildTransaction(instructions, recentBlockhash);
            } else {
              const message = new TransactionMessage({
                instructions,
                payerKey,
                recentBlockhash,
              }).compileToV0Message();

              tx = new VersionedTransaction(message);
            }

            tx = await signTransaction(tx);

            if (!wallet.sendTransaction) {
              throw new Error(
                "wallet must support sending transactions to use settlement accounts with exact",
              );
            }

            const transactionSignature = await wallet.sendTransaction(tx);

            const settleSecretKey = Buffer.from(
              settleKeypair.secretKey,
            ).toString("base64");

            const settlementRentDestination =
              options?.settlementRentDestination ?? wallet.publicKey.toBase58();

            const payload = {
              settleSecretKey,
              transactionSignature,
              settlementRentDestination,
            };

            return { payload };
          }
        }
      };

      return {
        exec,
        requirements,
      };
    });

    return res;
  };
}
