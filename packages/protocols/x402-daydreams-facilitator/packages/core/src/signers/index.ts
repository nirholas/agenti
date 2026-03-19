// Private-key signer factories
export {
  createPrivateKeyEvmSigner,
  createPrivateKeySvmSigner,
  type PrivateKeySignerConfig,
  type PrivateKeySvmSignerConfig,
} from "./default.js";

// CDP signer adapter
export {
  createCdpEvmSigner,
  createMultiNetworkCdpSigners,
  caip2ToCdpNetwork,
  getChainIdFromCaip2,
  type CdpSignerConfig,
  type CdpNetwork,
  type MultiNetworkCdpSignerConfig,
} from "./cdp.js";

// Re-export CDP SDK types for convenience
export type { CdpClient, EvmServerAccount } from "@coinbase/cdp-sdk";
