import {
  lookupX402Network,
  lookupKnownAsset,
  type KnownAsset,
  type ContractInfo,
} from "@faremeter/info/evm";
import { createLocalWallet } from "@faremeter/wallet-evm";
import { exact } from "@faremeter/payment-evm";
import { getTokenBalance } from "@faremeter/payment-evm/erc20";
import { isValidationError } from "@faremeter/types";
import { type WalletAdapter } from "./types";
import { PrivateKey } from "@faremeter/types/evm";
import { createPublicClient, http, type Chain } from "viem";
import * as chains from "viem/chains";

const networkAliases = new Map<string, Chain>(
  Object.entries({
    base: chains.base,
    "base-sepolia": chains.baseSepolia,
    polygon: chains.polygon,
    "polygon-amoy": chains.polygonAmoy,
    monad: chains.monad,
    "monad-testnet": chains.monadTestnet,
  } as const),
);
export function findNetworkAssetCombinations(
  networks: readonly string[],
  assets: readonly string[],
): { chain: Chain; contractInfo: ContractInfo[] }[] {
  const chains = networks
    .map((n) => networkAliases.get(n))
    .filter((x) => x !== undefined);

  if (chains.length < 1) {
    return [];
  }

  return chains.flatMap((chain) => {
    const contractInfo = assets
      .map((name) => lookupKnownAsset(chain.id, name as KnownAsset))
      .filter((x) => x !== undefined);

    if (contractInfo.length === 0) {
      return [];
    }

    return [
      {
        chain,
        contractInfo,
      },
    ];
  });
}

export type CreateAdapterOptions = {
  networks: readonly string[];
  assets: readonly string[];
};

export function createAdapter(opts: CreateAdapterOptions) {
  const chains = findNetworkAssetCombinations(opts.networks, opts.assets);

  if (chains.length === 0) {
    return undefined;
  }

  return {
    addLocalWallet: async (input: unknown) => {
      const privateKey = PrivateKey(input);

      if (isValidationError(privateKey)) {
        // We don't know what this private key is.
        return null;
      }

      const res: WalletAdapter[] = [];

      for (const { chain, contractInfo } of chains) {
        const publicClient = createPublicClient({
          chain,
          transport: http(),
        });

        for (const asset of contractInfo) {
          const wallet = await createLocalWallet(chain, privateKey);

          res.push({
            x402Id: [
              {
                scheme: "exact",
                asset: asset.address,
                network: lookupX402Network(chain.id),
              },
            ],
            paymentHandler: exact.createPaymentHandler(wallet, {
              asset,
            }),
            getBalance: async () => {
              const balance = await getTokenBalance({
                account: wallet.address,
                asset: asset.address,
                client: publicClient,
              });

              return {
                ...balance,
                name: asset.contractName,
              };
            },
          });
        }
      }

      return res;
    },
  };
}
