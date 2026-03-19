import { checkWalletDeployment } from "../../x402Adapter";
import { NETWORK } from "../../constants";

export async function buildWalletInfo(
  guestAddress: string,
  hostAddress?: string
) {
  const isDeployed = await checkWalletDeployment(guestAddress, NETWORK);
  return {
    type: "wallet_info",
    guestAddress,
    hostAddress: hostAddress || "Will be retrieved from Host agent",
    network: NETWORK,
    guestWalletDeployed: isDeployed
  } as const;
}


