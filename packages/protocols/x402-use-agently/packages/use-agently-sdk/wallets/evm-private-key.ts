import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { ExactEvmScheme } from "@x402/evm";
import { toClientEvmSigner } from "@x402/evm";
import type { SchemeRegistration } from "@x402/fetch";
import type { Wallet } from "./wallet";
import type { WalletConfig } from "../config";

export interface EvmPrivateKeyConfig extends WalletConfig {
  type: "evm-private-key";
  privateKey: `0x${string}`;
  address: string;
}

export function generateEvmPrivateKeyConfig(): EvmPrivateKeyConfig {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    type: "evm-private-key",
    privateKey,
    address: account.address,
  };
}

export class EvmPrivateKeyWallet implements Wallet {
  readonly type = "evm-private-key";
  readonly address: string;
  private readonly privateKey: `0x${string}`;
  private readonly rpcUrl?: string;

  constructor(privateKey: `0x${string}`, rpcUrl?: string) {
    this.privateKey = privateKey;
    this.address = privateKeyToAccount(privateKey).address;
    this.rpcUrl = rpcUrl;
  }

  getX402Schemes(): SchemeRegistration[] {
    const account = privateKeyToAccount(this.privateKey);

    const customTransport = this.rpcUrl ? http(this.rpcUrl) : http();
    const baseClient = createPublicClient({ chain: base, transport: customTransport });
    const baseSigner = toClientEvmSigner(account, baseClient);

    const baseSepoliaClient = createPublicClient({ chain: baseSepolia, transport: customTransport });
    const baseSepoliaSigner = toClientEvmSigner(account, baseSepoliaClient);

    return [
      {
        network: "eip155:8453" as const,
        client: new ExactEvmScheme(baseSigner),
      },
      {
        network: "eip155:84532" as const,
        client: new ExactEvmScheme(baseSepoliaSigner),
      },
    ];
  }
}
