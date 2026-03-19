/**
 * Default Facilitator Setup - Application-specific with side effects
 *
 * This module creates a default facilitator instance based on environment
 * configuration. It has side effects and should only be imported by the
 * CLI server, not by library consumers.
 *
 * Library consumers should use createFacilitator() from the main export instead.
 */

import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";

import {
  createFacilitator,
  type FacilitatorConfig,
} from "@daydreamsai/facilitator";
import {
  createCdpEvmSigner,
  createPrivateKeyEvmSigner,
  createPrivateKeySvmSigner,
  type CdpNetwork,
} from "@daydreamsai/facilitator/signers";
import {
  getNetworkSetups,
  getStarknetNetworkSetups,
  getSvmNetworkSetups,
  getRpcUrl,
  USE_CDP,
  SVM_PRIVATE_KEY,
  CDP_ACCOUNT_NAME,
} from "@daydreamsai/facilitator/config";

type EvmSignerConfig = FacilitatorConfig["evmSigners"] extends
  | (infer T)[]
  | undefined
  ? T
  : never;
type SvmSignerConfig = FacilitatorConfig["svmSigners"] extends
  | (infer T)[]
  | undefined
  ? T
  : never;
type StarknetConfig = FacilitatorConfig["starknetConfigs"] extends
  | (infer T)[]
  | undefined
  ? T
  : never;
type NetworkId = EvmSignerConfig["networks"];
const UPTO_VERIFY_BALANCE_CHECK =
  process.env.UPTO_VERIFY_BALANCE_CHECK === "true";

// ============================================================================
// Default Signers
// ============================================================================

async function createDefaultSigners(): Promise<{
  evmSigners: EvmSignerConfig[];
  svmSigners: SvmSignerConfig[];
  starknetConfigs: StarknetConfig[];
}> {
  const networkSetups = getNetworkSetups();
  const starknetNetworkSetups = getStarknetNetworkSetups();

  const starknetConfigs: StarknetConfig[] = [];
  for (const network of starknetNetworkSetups) {
    if (!network.rpcUrl) {
      console.warn(`⚠️  No RPC URL for ${network.name} - skipping`);
      continue;
    }
    if (!network.paymasterEndpoint) {
      console.warn(`⚠️  No paymaster endpoint for ${network.name} - skipping`);
      continue;
    }

    starknetConfigs.push({
      network: network.caip as StarknetConfig["network"],
      rpcUrl: network.rpcUrl,
      paymasterEndpoint: network.paymasterEndpoint,
      ...(network.paymasterApiKey
        ? { paymasterApiKey: network.paymasterApiKey }
        : {}),
      sponsorAddress: network.sponsorAddress,
    });
  }

  if (USE_CDP) {
    // CDP Signer (preferred)
    const cdp = new CdpClient();

    const account = await cdp.evm.getOrCreateAccount({
      name: CDP_ACCOUNT_NAME!,
    });

    console.info(`CDP Facilitator account: ${account.address}`);

    const evmSigners: EvmSignerConfig[] = [];

    // Create a signer for each configured network
    for (const network of networkSetups) {
      const signer = createCdpEvmSigner({
        cdpClient: cdp,
        account,
        network: network.name as CdpNetwork,
        rpcUrl: network.rpcUrl,
      });

      evmSigners.push({
        signer,
        networks: network.caip as NetworkId,
        schemes: ["exact", "upto"],
        upto: { verifyBalanceCheck: UPTO_VERIFY_BALANCE_CHECK },
        deployERC4337WithEIP6492: true,
        // Enable v1 for networks that support it
        registerV1: network.supportsV1,
        v1NetworkNames: network.supportsV1 ? network.name : undefined,
      });
    }

    // CDP doesn't support SVM yet, use private key signer if available
    const svmSigners: SvmSignerConfig[] = [];
    if (SVM_PRIVATE_KEY) {
      const svmSigner = await createPrivateKeySvmSigner();
      // Register for each configured SVM network
      const svmNetworkSetups = getSvmNetworkSetups();
      for (const network of svmNetworkSetups) {
        svmSigners.push({
          signer: svmSigner,
          networks: network.caip as NetworkId,
        });
      }
    }

    return { evmSigners, svmSigners, starknetConfigs };
  } else {
    // Private Key Signer (fallback)
    const evmSigners: EvmSignerConfig[] = [];

    // Create a signer for each configured network
    for (const network of networkSetups) {
      const rpcUrl = getRpcUrl(network.name);
      if (!rpcUrl) {
        console.warn(`⚠️  No RPC URL for ${network.name} - skipping`);
        continue;
      }

      const signer = createPrivateKeyEvmSigner({
        network: network.name,
        rpcUrl,
      });

      evmSigners.push({
        signer,
        networks: network.caip as NetworkId,
        schemes: ["exact", "upto"],
        upto: { verifyBalanceCheck: UPTO_VERIFY_BALANCE_CHECK },
        deployERC4337WithEIP6492: true,
        // Enable v1 for networks that support it
        registerV1: network.supportsV1,
        v1NetworkNames: network.supportsV1 ? network.name : undefined,
      });
    }

    const svmSigners: SvmSignerConfig[] = [];
    if (SVM_PRIVATE_KEY) {
      const svmSigner = await createPrivateKeySvmSigner();
      // Register for each configured SVM network
      const svmNetworkSetups = getSvmNetworkSetups();
      for (const network of svmNetworkSetups) {
        svmSigners.push({
          signer: svmSigner,
          networks: network.caip as NetworkId,
        });
      }
    }

    return { evmSigners, svmSigners, starknetConfigs };
  }
}

// ============================================================================
// Default Instance
// ============================================================================

export const defaultSigners = await createDefaultSigners();
