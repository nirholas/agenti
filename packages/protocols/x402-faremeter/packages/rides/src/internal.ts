import {
  type PaymentHandler,
  type PaymentExecer,
} from "@faremeter/types/client";
import {
  wrap as wrapFetch,
  type WrapOpts,
  chooseFirstAvailable,
} from "@faremeter/fetch";

import {
  KnownNetworks,
  type KnownNetwork,
  KnownAssets,
  type KnownAsset,
  type PayerAdapter,
  type GetBalance,
  type WalletAdapter,
} from "./types";
import { logger } from "./logger";

import * as solana from "./solana";
import * as evm from "./evm";

/**
 * Configuration options for creating a payer instance.
 */
export interface CreatePayerArgs {
  /** Networks to enable for payments. Defaults to all known networks. */
  networks?: KnownNetwork[];
  /** Assets to enable for payments. Defaults to all known assets. */
  assets?: KnownAsset[];
  /** Custom fetch function to wrap. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** Additional options for fetch wrapping and balance checks. */
  options?: {
    /** Options passed to the fetch wrapper. */
    fetch?: WrapOpts;
    /** If true, skips balance validation before payment attempts. */
    disableBalanceChecks?: boolean;
  };
}

type PaymentIdKey = { network: string; scheme: string; asset: string };

function idKey({ network, scheme, asset }: PaymentIdKey) {
  return `${network}\0${scheme}\0${asset}`;
}

/**
 * Creates a payer instance that manages wallets and payment-enabled fetch.
 *
 * The payer automatically handles x402 payment flows by wrapping fetch with
 * payment capabilities. Wallets must be added via addLocalWallet before
 * making paid requests.
 *
 * @param args - Optional configuration for networks, assets, and fetch behavior
 * @returns A payer object with addLocalWallet and fetch methods
 */
export function createPayer(args?: CreatePayerArgs) {
  const {
    networks = KnownNetworks,
    assets = KnownAssets,
    fetch = globalThis.fetch,
  } = args ?? {};

  const paymentHandlers: PaymentHandler[] = [];
  const balanceLookup = new Map<string, GetBalance>();

  const adapters: PayerAdapter[] = [];

  for (const plugin of [solana, evm]) {
    const adapter = plugin.createAdapter({ networks, assets });

    if (adapter !== undefined) {
      adapters.push(adapter);
    }
  }

  const wrapFetchOptions = {
    ...(args?.options?.fetch ?? {}),
  };

  if (!args?.options?.disableBalanceChecks) {
    const finalChooser =
      args?.options?.fetch?.payerChooser ?? chooseFirstAvailable;

    wrapFetchOptions.payerChooser = async function (execer: PaymentExecer[]) {
      const viableOptions = [];
      for (const e of execer) {
        const req = e.requirements;
        const getBalance = balanceLookup.get(idKey(req));

        if (getBalance === undefined) {
          continue;
        }

        let balance;

        try {
          balance = await getBalance();
        } catch (cause) {
          logger.warning(
            `failed to check balance on ${req.network} for ${req.scheme}, skipping`,
            { cause },
          );
          continue;
        }

        // XXX - We need to do a better job of understanding decimals here.
        if (balance.amount < BigInt(req.amount)) {
          logger.info(
            `Not paying with ${balance.name} on ${req.network} using the ${req.scheme} scheme: balance is ${balance.amount} which is less than ${req.amount}`,
          );

          continue;
        }

        viableOptions.push(e);
      }

      return finalChooser(viableOptions);
    };
  }

  const setupFetch = () => {
    if (paymentHandlers.length < 1) {
      throw new Error("no usable wallets have been attached to enable payment");
    }

    return wrapFetch(fetch, {
      ...wrapFetchOptions,
      handlers: paymentHandlers,
    });
  };

  let _fetch: typeof fetch | undefined;

  /**
   * Registers a wallet adapter directly, bypassing the plugin system.
   *
   * @param adapter - The wallet adapter to register
   */
  const addWalletAdapter = (adapter: WalletAdapter) => {
    _fetch = undefined;
    paymentHandlers.push(adapter.paymentHandler);
    for (const id of adapter.x402Id) {
      balanceLookup.set(idKey(id), adapter.getBalance);
    }
  };

  return {
    addWalletAdapter,
    addLocalWallet: async (input: unknown) => {
      if (input === undefined) {
        throw new Error("undefined is not a valid local wallet");
      }

      const newWallets = [];

      for (const adapter of adapters) {
        const res = await adapter.addLocalWallet(input);
        if (res === null) {
          continue;
        }

        newWallets.push(...res);
      }

      if (newWallets.length === 0) {
        throw new Error(
          "couldn't find any way to use provided local wallet information",
        );
      }

      for (const wallet of newWallets) {
        addWalletAdapter(wallet);
      }
    },
    fetch: async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      _fetch ??= setupFetch();
      return _fetch(input, init);
    },
  };
}

/**
 * Default payer instance with all networks and assets enabled.
 *
 * Use addLocalWallet to attach wallet credentials before making requests
 * with the fetch method.
 */
export const payer = createPayer();
