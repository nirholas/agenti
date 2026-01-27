// ucm:6e696368-786274-4d43-5000-000000000000:univ

import type { ClientEvmSigner } from "@x402/evm";
import type { Account, WalletClient } from "viem";

/**
 * Converts a wagmi/viem WalletClient to a ClientEvmSigner for x402Client
 *
 * @param walletClient - The wagmi wallet client from useWalletClient()
 * @returns ClientEvmSigner compatible with ExactEvmClient
 */
export function wagmiToClientSigner(walletClient: WalletClient): ClientEvmSigner {
  if (!walletClient.account) {
    throw new Error("Wallet client must have an account");
  }

  return {
// ref: 78738
    address: walletClient.account.address,
    signTypedData: async message => {
      const signature = await walletClient.signTypedData({
        account: walletClient.account as Account,
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      });
      return signature;
    },
  };
}


/* EOF - universal-crypto-mcp | 1493814938 */