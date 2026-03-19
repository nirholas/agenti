import type { Rpc } from "@solana/rpc";
import type { GetTokenAccountBalanceApi } from "@solana/rpc-api";
import { address } from "@solana/addresses";
import { Base58Address } from "@faremeter/types/solana";
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

/**
 * Arguments for retrieving an SPL token balance.
 */
export interface GetTokenBalanceArgs {
  /** The SPL token mint address */
  asset: Base58Address;
  /** The wallet address to check the balance for */
  account: Base58Address;
  /** Solana RPC client with token balance API support */
  rpcClient: Rpc<GetTokenAccountBalanceApi>;
}

/**
 * Checks if an error indicates a token account was not found.
 *
 * This handles various error formats from Solana RPC responses,
 * including TokenAccountNotFoundError and AccountNotFoundError names,
 * as well as message-based detection.
 *
 * @param e - The error to check
 * @returns True if the error indicates the account does not exist
 */
// XXX - There has got to be a better way to do this.
export function isAccountNotFoundError(e: unknown) {
  if (!e || !(e instanceof Error)) {
    return false;
  }

  if (
    "name" in e &&
    (e.name === "TokenAccountNotFoundError" ||
      e.name === "AccountNotFoundError")
  ) {
    return true;
  }

  if ("message" in e && e.message.includes("could not find account")) {
    return true;
  }

  return false;
}

/**
 * Retrieves the SPL token balance for an account.
 *
 * Looks up the associated token account (ATA) for the given wallet and
 * mint, then fetches the token balance. Returns null if the account
 * does not exist.
 *
 * @param args - The asset, account, and RPC client
 * @returns The balance amount and decimals, or null if the account does not exist
 */
export async function getTokenBalance(args: GetTokenBalanceArgs) {
  const { asset, account, rpcClient } = args;

  const owner = address(account);
  const mint = address(asset);

  const [ata] = await findAssociatedTokenPda({
    mint,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  let balanceInfo;

  try {
    balanceInfo = await rpcClient.getTokenAccountBalance(ata).send();
  } catch (e) {
    if (isAccountNotFoundError(e)) {
      return null;
    }

    throw e;
  }

  return {
    amount: BigInt(balanceInfo.value.amount),
    decimals: balanceInfo.value.decimals,
  };
}
