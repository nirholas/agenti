import { type PaymentHandler } from "@faremeter/types/client";

export const KnownNetworks = [
  "base",
  "base-sepolia",
  "monad",
  "monad-testnet",
  "polygon",
  "polygon-amoy",
  "solana",
  "solana-devnet",
] as const;

export type KnownNetwork = (typeof KnownNetworks)[number];

export const KnownAssets = ["USDC"] as const;

export type KnownAsset = (typeof KnownAssets)[number];

export type Balance = {
  name: string;
  amount: bigint;
  decimals: number;
};

export type GetBalance = () => Promise<Balance>;

export type PaymentIdV2 = {
  scheme: string;
  network: string;
  asset: string;
};

export interface WalletAdapter {
  x402Id: PaymentIdV2[];
  paymentHandler: PaymentHandler;
  getBalance: GetBalance;
}

export interface PayerAdapter {
  addLocalWallet: (input: unknown) => Promise<WalletAdapter[] | null>;
}
