import { describe, it, expect } from "bun:test";
import {
  parseNetworkList,
  validateNetworks,
  validateSvmNetworks,
  validateStarknetNetworks,
  getNetwork,
  getNetworkCaip,
  resolveRpcUrl,
  getSvmNetwork,
  getSvmNetworkCaip,
  resolveSvmRpcUrl,
  getStarknetNetwork,
  getStarknetNetworkCaip,
  resolveStarknetRpcUrl,
  toStarknetCanonicalCaip,
  toStarknetLegacyCaip,
  supportsV1,
  getV1Networks,
  EVM_NETWORKS,
  SVM_NETWORKS,
  STARKNET_NETWORKS,
  STARKNET_CAIP_IDS,
} from "../../src/networks.js";

describe("parseNetworkList", () => {
  it("returns empty array for undefined input", () => {
    expect(parseNetworkList(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseNetworkList("")).toEqual([]);
  });

  it("parses single network", () => {
    expect(parseNetworkList("base")).toEqual(["base"]);
  });

  it("parses multiple networks", () => {
    expect(parseNetworkList("base,ethereum,polygon")).toEqual([
      "base",
      "ethereum",
      "polygon",
    ]);
  });

  it("trims whitespace", () => {
    expect(parseNetworkList("  base , ethereum  ")).toEqual([
      "base",
      "ethereum",
    ]);
  });

  it("converts to lowercase", () => {
    expect(parseNetworkList("BASE,Ethereum,POLYGON")).toEqual([
      "base",
      "ethereum",
      "polygon",
    ]);
  });

  it("filters empty segments", () => {
    expect(parseNetworkList("base,,ethereum")).toEqual(["base", "ethereum"]);
  });
});

describe("validateNetworks", () => {
  it("returns valid networks only", () => {
    expect(validateNetworks(["base", "invalid-network", "ethereum"])).toEqual([
      "base",
      "ethereum",
    ]);
  });

  it("returns empty array when all invalid", () => {
    expect(validateNetworks(["invalid1", "invalid2"])).toEqual([]);
  });

  it("returns all when all valid", () => {
    expect(validateNetworks(["base", "ethereum"])).toEqual([
      "base",
      "ethereum",
    ]);
  });

  it("handles empty array", () => {
    expect(validateNetworks([])).toEqual([]);
  });
});

describe("validateSvmNetworks", () => {
  it("returns valid SVM networks", () => {
    expect(validateSvmNetworks(["solana-mainnet", "solana-devnet"])).toEqual([
      "solana-mainnet",
      "solana-devnet",
    ]);
  });

  it("filters invalid SVM networks", () => {
    expect(
      validateSvmNetworks(["solana-mainnet", "invalid", "solana-devnet"])
    ).toEqual(["solana-mainnet", "solana-devnet"]);
  });

  it("returns empty array when all invalid", () => {
    expect(validateSvmNetworks(["invalid"])).toEqual([]);
  });
});

describe("validateStarknetNetworks", () => {
  it("returns valid Starknet networks", () => {
    expect(
      validateStarknetNetworks(["starknet-mainnet", "starknet-sepolia"])
    ).toEqual(["starknet-mainnet", "starknet-sepolia"]);
  });

  it("filters invalid Starknet networks", () => {
    expect(
      validateStarknetNetworks(["starknet-mainnet", "invalid", "starknet-sepolia"])
    ).toEqual(["starknet-mainnet", "starknet-sepolia"]);
  });

  it("returns empty array when all invalid", () => {
    expect(validateStarknetNetworks(["invalid"])).toEqual([]);
  });
});

describe("getNetwork", () => {
  it("returns config for valid network", () => {
    const config = getNetwork("base");
    expect(config).toBeDefined();
    expect(config?.chainId).toBe(8453);
    expect(config?.caip).toBe("eip155:8453");
  });

  it("returns undefined for invalid network", () => {
    expect(getNetwork("invalid-network")).toBeUndefined();
  });

  it("returns config for all supported networks", () => {
    for (const network of Object.keys(EVM_NETWORKS)) {
      expect(getNetwork(network)).toBeDefined();
    }
  });
});

describe("getNetworkCaip", () => {
  it("returns CAIP for base", () => {
    expect(getNetworkCaip("base")).toBe("eip155:8453");
  });

  it("returns CAIP for base-sepolia", () => {
    expect(getNetworkCaip("base-sepolia")).toBe("eip155:84532");
  });

  it("returns CAIP for ethereum", () => {
    expect(getNetworkCaip("ethereum")).toBe("eip155:1");
  });

  it("returns CAIP for polygon", () => {
    expect(getNetworkCaip("polygon")).toBe("eip155:137");
  });

  it("returns undefined for invalid network", () => {
    expect(getNetworkCaip("invalid")).toBeUndefined();
  });
});

describe("resolveRpcUrl", () => {
  it("returns explicit URL when provided", () => {
    const url = resolveRpcUrl("base", {
      explicitUrl: "https://custom.rpc.url",
    });
    expect(url).toBe("https://custom.rpc.url");
  });

  it("returns Alchemy URL when API key provided", () => {
    const url = resolveRpcUrl("base", {
      alchemyApiKey: "test-alchemy-key",
    });
    expect(url).toBe("https://base-mainnet.g.alchemy.com/v2/test-alchemy-key");
  });

  it("returns Infura URL when API key provided", () => {
    const url = resolveRpcUrl("base", {
      infuraApiKey: "test-infura-key",
    });
    expect(url).toBe("https://base-mainnet.infura.io/v3/test-infura-key");
  });

  it("returns public fallback when no keys", () => {
    const url = resolveRpcUrl("base", {});
    expect(url).toBe("https://mainnet.base.org");
  });

  it("prefers explicit over Alchemy", () => {
    const url = resolveRpcUrl("base", {
      explicitUrl: "https://custom.url",
      alchemyApiKey: "alchemy-key",
    });
    expect(url).toBe("https://custom.url");
  });

  it("prefers Alchemy over Infura", () => {
    const url = resolveRpcUrl("base", {
      alchemyApiKey: "alchemy-key",
      infuraApiKey: "infura-key",
    });
    expect(url).toContain("alchemy.com");
  });

  it("returns undefined for unknown network", () => {
    const url = resolveRpcUrl("unknown", {});
    expect(url).toBeUndefined();
  });
});

describe("getSvmNetwork", () => {
  it("returns config for solana-mainnet", () => {
    const config = getSvmNetwork("solana-mainnet");
    expect(config).toBeDefined();
    expect(config?.caip).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  });

  it("returns config for solana-devnet", () => {
    const config = getSvmNetwork("solana-devnet");
    expect(config).toBeDefined();
    expect(config?.caip).toBe("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
  });

  it("returns undefined for invalid network", () => {
    expect(getSvmNetwork("invalid")).toBeUndefined();
  });
});

describe("getSvmNetworkCaip", () => {
  it("returns CAIP for solana-mainnet", () => {
    expect(getSvmNetworkCaip("solana-mainnet")).toBe(
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    );
  });

  it("returns undefined for invalid network", () => {
    expect(getSvmNetworkCaip("invalid")).toBeUndefined();
  });
});

describe("resolveSvmRpcUrl", () => {
  it("returns explicit URL when provided", () => {
    const url = resolveSvmRpcUrl("solana-mainnet", {
      explicitUrl: "https://custom.solana.rpc",
    });
    expect(url).toBe("https://custom.solana.rpc");
  });

  it("returns Helius URL when API key provided", () => {
    const url = resolveSvmRpcUrl("solana-mainnet", {
      heliusApiKey: "test-helius-key",
    });
    expect(url).toBe("https://mainnet.helius-rpc.com/?api-key=test-helius-key");
  });

  it("returns public fallback when no keys", () => {
    const url = resolveSvmRpcUrl("solana-mainnet", {});
    expect(url).toBe("https://api.mainnet-beta.solana.com");
  });

  it("returns undefined for unknown network", () => {
    const url = resolveSvmRpcUrl("unknown", {});
    expect(url).toBeUndefined();
  });
});

describe("getStarknetNetwork", () => {
  it("returns config for starknet-mainnet", () => {
    const config = getStarknetNetwork("starknet-mainnet");
    expect(config).toBeDefined();
    expect(config?.caip).toBe(STARKNET_CAIP_IDS.MAINNET);
  });

  it("returns config for starknet-sepolia", () => {
    const config = getStarknetNetwork("starknet-sepolia");
    expect(config).toBeDefined();
    expect(config?.caip).toBe(STARKNET_CAIP_IDS.SEPOLIA);
  });

  it("returns undefined for invalid network", () => {
    expect(getStarknetNetwork("invalid")).toBeUndefined();
  });
});

describe("getStarknetNetworkCaip", () => {
  it("returns CAIP for starknet-mainnet", () => {
    expect(getStarknetNetworkCaip("starknet-mainnet")).toBe("starknet:SN_MAIN");
  });

  it("returns CAIP for starknet-sepolia", () => {
    expect(getStarknetNetworkCaip("starknet-sepolia")).toBe(
      "starknet:SN_SEPOLIA"
    );
  });

  it("returns undefined for invalid network", () => {
    expect(getStarknetNetworkCaip("invalid")).toBeUndefined();
  });
});

describe("resolveStarknetRpcUrl", () => {
  it("returns explicit URL when provided", () => {
    const url = resolveStarknetRpcUrl("starknet-mainnet", {
      explicitUrl: "https://custom.starknet.rpc",
    });
    expect(url).toBe("https://custom.starknet.rpc");
  });

  it("returns Alchemy URL when API key provided", () => {
    const url = resolveStarknetRpcUrl("starknet-mainnet", {
      alchemyApiKey: "test-alchemy-key",
    });
    expect(url).toBe(
      "https://starknet-mainnet.g.alchemy.com/v2/test-alchemy-key"
    );
  });

  it("returns public fallback when no keys", () => {
    const url = resolveStarknetRpcUrl("starknet-mainnet", {});
    expect(url).toBe("https://starknet-mainnet.public.blastapi.io");
  });

  it("returns undefined for unknown network", () => {
    const url = resolveStarknetRpcUrl("unknown", {});
    expect(url).toBeUndefined();
  });
});

describe("toStarknetCanonicalCaip", () => {
  it("returns canonical CAIP unchanged", () => {
    expect(toStarknetCanonicalCaip("starknet:SN_MAIN")).toBe("starknet:SN_MAIN");
  });

  it("converts legacy to canonical", () => {
    expect(toStarknetCanonicalCaip("starknet:mainnet")).toBe("starknet:SN_MAIN");
    expect(toStarknetCanonicalCaip("starknet:sepolia")).toBe(
      "starknet:SN_SEPOLIA"
    );
  });

  it("returns undefined for invalid CAIP", () => {
    expect(toStarknetCanonicalCaip("invalid")).toBeUndefined();
  });
});

describe("toStarknetLegacyCaip", () => {
  it("returns legacy CAIP unchanged", () => {
    expect(toStarknetLegacyCaip("starknet:mainnet")).toBe("starknet:mainnet");
  });

  it("converts canonical to legacy", () => {
    expect(toStarknetLegacyCaip("starknet:SN_MAIN")).toBe("starknet:mainnet");
    expect(toStarknetLegacyCaip("starknet:SN_SEPOLIA")).toBe("starknet:sepolia");
  });

  it("returns undefined for invalid CAIP", () => {
    expect(toStarknetLegacyCaip("invalid")).toBeUndefined();
  });
});

describe("supportsV1", () => {
  it("returns true for base", () => {
    expect(supportsV1("base")).toBe(true);
  });

  it("returns true for base-sepolia", () => {
    expect(supportsV1("base-sepolia")).toBe(true);
  });

  it("returns false for unknown network", () => {
    expect(supportsV1("unknown-network")).toBe(false);
  });
});

describe("getV1Networks", () => {
  it("returns array of V1 supported networks", () => {
    const v1Networks = getV1Networks();
    expect(Array.isArray(v1Networks)).toBe(true);
    expect(v1Networks.length).toBeGreaterThan(0);
    // Base should be in V1 networks
    expect(v1Networks).toContain("base");
  });
});

describe("EVM_NETWORKS constant", () => {
  it("contains expected networks", () => {
    expect(EVM_NETWORKS.base).toBeDefined();
    expect(EVM_NETWORKS["base-sepolia"]).toBeDefined();
    expect(EVM_NETWORKS.ethereum).toBeDefined();
    expect(EVM_NETWORKS.polygon).toBeDefined();
    expect(EVM_NETWORKS.arbitrum).toBeDefined();
    expect(EVM_NETWORKS.optimism).toBeDefined();
  });

  it("has correct chain IDs", () => {
    expect(EVM_NETWORKS.base.chainId).toBe(8453);
    expect(EVM_NETWORKS.ethereum.chainId).toBe(1);
    expect(EVM_NETWORKS.polygon.chainId).toBe(137);
  });
});

describe("SVM_NETWORKS constant", () => {
  it("contains expected networks", () => {
    expect(SVM_NETWORKS["solana-mainnet"]).toBeDefined();
    expect(SVM_NETWORKS["solana-devnet"]).toBeDefined();
    expect(SVM_NETWORKS["solana-testnet"]).toBeDefined();
  });
});

describe("STARKNET_NETWORKS constant", () => {
  it("contains expected networks", () => {
    expect(STARKNET_NETWORKS["starknet-mainnet"]).toBeDefined();
    expect(STARKNET_NETWORKS["starknet-sepolia"]).toBeDefined();
  });
});

describe("STARKNET_CAIP_IDS constant", () => {
  it("contains canonical CAIP IDs", () => {
    expect(STARKNET_CAIP_IDS.MAINNET).toBe("starknet:SN_MAIN");
    expect(STARKNET_CAIP_IDS.SEPOLIA).toBe("starknet:SN_SEPOLIA");
  });
});
