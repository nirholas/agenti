import { describe, it, expect } from "vitest";
import {
  buildAuthorization,
  buildWwwAuthenticate,
  descriptorToChallenge,
  parseAmount,
  parseAuthorization,
  parseWwwAuthenticate,
} from "../protocol.ts";

describe("parseWwwAuthenticate", () => {
  it("parses a standard x402 challenge", () => {
    const header = 'x402 chain="solana" token="USDC" amount="0.05" address="SolAddr1111111111111111"';
    const challenge = parseWwwAuthenticate(header);
    expect(challenge).not.toBeNull();
    expect(challenge!.chain).toBe("solana");
    expect(challenge!.token).toBe("USDC");
    expect(challenge!.amount).toBe("0.05");
    expect(challenge!.address).toBe("SolAddr1111111111111111");
  });

  it("parses optional fields", () => {
    const header = 'x402 chain="solana" token="USDC" amount="1.00" address="A" service_hash="abc" service_tier="premium"';
    const challenge = parseWwwAuthenticate(header);
    expect(challenge!.serviceHash).toBe("abc");
    expect(challenge!.serviceTier).toBe("premium");
  });

  it("returns null for non-x402 header", () => {
    expect(parseWwwAuthenticate("Bearer token123")).toBeNull();
    expect(parseWwwAuthenticate("")).toBeNull();
    expect(parseWwwAuthenticate("Basic realm=example")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseWwwAuthenticate('x402 chain="solana" token="USDC" amount="0.05"')).toBeNull(); // missing address
    expect(parseWwwAuthenticate('x402 token="USDC" amount="0.05" address="A"')).toBeNull();     // missing chain
    expect(parseWwwAuthenticate('x402 chain="solana" amount="0.05" address="A"')).toBeNull();   // missing token
  });

  it("returns null for bare 'x402' with no fields", () => {
    expect(parseWwwAuthenticate("x402")).toBeNull();
  });

  it("is case-insensitive for scheme prefix", () => {
    const header = 'X402 chain="solana" token="USDC" amount="0.05" address="Addr"';
    expect(parseWwwAuthenticate(header)).not.toBeNull();
  });

  it("trims leading/trailing whitespace", () => {
    const header = '  x402 chain="solana" token="USDC" amount="0.05" address="A"  ';
    expect(parseWwwAuthenticate(header)).not.toBeNull();
  });

  it("parses correctly when address is empty string", () => {
    // address="" is syntactically valid (business logic validation is upstream)
    const header = 'x402 chain="solana" token="USDC" amount="0.05" address=""';
    // fields["address"] = "" → fails the `if (!fields[req])` guard → returns null
    // This is intentional: empty address is treated as missing
    expect(parseWwwAuthenticate(header)).toBeNull();
  });

  it("returns null for oversized header (>8KB)", () => {
    // Protects against regex exhaustion from malicious servers
    const big = "x402 " + "a".repeat(8200);
    expect(parseWwwAuthenticate(big)).toBeNull();
  });

  it("returns undefined (not empty string) for absent optional fields", () => {
    const header = 'x402 chain="solana" token="USDC" amount="0.05" address="Addr"';
    const challenge = parseWwwAuthenticate(header);
    expect(challenge).not.toBeNull();
    // Optional fields must be undefined when absent, not "" — so TypeScript `!== undefined` works
    expect(challenge!.serviceHash).toBeUndefined();
    expect(challenge!.serviceTier).toBeUndefined();
    expect(challenge!.refundContract).toBeUndefined();
  });

  it("returns the value (not undefined) for present optional fields", () => {
    const header = 'x402 chain="solana" token="USDC" amount="0.05" address="Addr" service_hash="abc123"';
    const challenge = parseWwwAuthenticate(header);
    expect(challenge!.serviceHash).toBe("abc123");
  });
});

describe("buildWwwAuthenticate", () => {
  it("produces a valid x402 header", () => {
    const challenge = { chain: "solana", token: "USDC", amount: "0.05", address: "RecipAddr" };
    const header = buildWwwAuthenticate(challenge);
    expect(header).toMatch(/^x402 /);
    expect(header).toContain('chain="solana"');
    expect(header).toContain('token="USDC"');
    expect(header).toContain('amount="0.05"');
    expect(header).toContain('address="RecipAddr"');
  });

  it("round-trips through parse", () => {
    const original = { chain: "base", token: "USDC", amount: "1.00", address: "0xABC" };
    const header = buildWwwAuthenticate(original);
    const parsed = parseWwwAuthenticate(header);
    expect(parsed!.chain).toBe(original.chain);
    expect(parsed!.token).toBe(original.token);
    expect(parsed!.amount).toBe(original.amount);
    expect(parsed!.address).toBe(original.address);
  });

  it("throws on CR/LF in fields (header injection prevention)", () => {
    expect(() => buildWwwAuthenticate({ chain: "sol\r\nana", token: "USDC", amount: "0.05", address: "A" })).toThrow("unsafe");
    expect(() => buildWwwAuthenticate({ chain: "solana", token: "US\nDC", amount: "0.05", address: "A" })).toThrow("unsafe");
    expect(() => buildWwwAuthenticate({ chain: "solana", token: "USDC", amount: "0.05", address: 'A"B' })).toThrow("unsafe");
  });

  it("includes optional fields when present, omits when absent", () => {
    const withHash = { chain: "solana", token: "USDC", amount: "0.01", address: "A", serviceHash: "sha256abc" };
    const header = buildWwwAuthenticate(withHash);
    expect(header).toContain('service_hash="sha256abc"');

    const withoutHash = { chain: "solana", token: "USDC", amount: "0.01", address: "A" };
    const headerNoOptional = buildWwwAuthenticate(withoutHash);
    expect(headerNoOptional).not.toContain("service_hash");
    expect(headerNoOptional).not.toContain("service_tier");
    expect(headerNoOptional).not.toContain("refund_contract");
  });
});

describe("parseAuthorization", () => {
  it("parses structured format", () => {
    const header = 'x402 tx_hash="abc123" payer_address="PayerAddr" chain="solana" request_id="req1"';
    const proof = parseAuthorization(header);
    expect(proof!.txHash).toBe("abc123");
    expect(proof!.payerAddress).toBe("PayerAddr");
    expect(proof!.chain).toBe("solana");
    expect(proof!.requestId).toBe("req1");
  });

  it("parses legacy format (bare tx_hash)", () => {
    const header = "x402 abc123hash";
    const proof = parseAuthorization(header);
    expect(proof!.txHash).toBe("abc123hash");
  });

  it("rejects legacy format with spaces (ambiguous multi-token)", () => {
    // "a b c" is not a single word token — must return null
    expect(parseAuthorization("x402 a b c")).toBeNull();
  });

  it("returns null for non-x402 auth", () => {
    expect(parseAuthorization("Bearer eyJhbg")).toBeNull();
    expect(parseAuthorization("")).toBeNull();
    expect(parseAuthorization("x402")).toBeNull(); // no payload
  });

  it("defaults chain to 'solana' when not present", () => {
    const header = 'x402 tx_hash="abc123"';
    const proof = parseAuthorization(header);
    expect(proof!.chain).toBe("solana");
  });

  it("returns undefined (not empty string) for absent optional fields", () => {
    const header = 'x402 tx_hash="abc123" chain="solana"';
    const proof = parseAuthorization(header);
    expect(proof!.payerAddress).toBeUndefined();
    expect(proof!.requestId).toBeUndefined();
  });

  it("returns null for malformed structured format without tx_hash", () => {
    const header = 'x402 payer_address="Addr" chain="solana"'; // missing tx_hash
    expect(parseAuthorization(header)).toBeNull();
  });
});

describe("buildAuthorization", () => {
  it("produces a valid Authorization header", () => {
    const proof = { txHash: "tx1", chain: "solana", payerAddress: "Payer", requestId: "req1" };
    const header = buildAuthorization(proof);
    expect(header).toContain('tx_hash="tx1"');
    expect(header).toContain('chain="solana"');
    expect(header).toContain('payer_address="Payer"');
    expect(header).toContain('request_id="req1"');
    expect(header).toMatch(/^x402 /);
  });

  it("round-trips through parse", () => {
    const original = { txHash: "hash_abc", chain: "solana", payerAddress: "P1", requestId: "r1" };
    const header = buildAuthorization(original);
    const parsed = parseAuthorization(header);
    expect(parsed!.txHash).toBe(original.txHash);
    expect(parsed!.chain).toBe(original.chain);
    expect(parsed!.payerAddress).toBe(original.payerAddress);
    expect(parsed!.requestId).toBe(original.requestId);
  });

  it("omits optional fields when absent", () => {
    const header = buildAuthorization({ txHash: "tx1" });
    expect(header).toContain('tx_hash="tx1"');
    expect(header).not.toContain("payer_address");
    expect(header).not.toContain("request_id");
  });

  it("throws on unsafe characters in txHash (injection prevention)", () => {
    expect(() => buildAuthorization({ txHash: 'tx"1' })).toThrow("unsafe");
    expect(() => buildAuthorization({ txHash: "tx\r\n1" })).toThrow("unsafe");
  });

  it("throws on unsafe characters in optional fields", () => {
    expect(() => buildAuthorization({ txHash: "tx1", payerAddress: 'addr"x' })).toThrow("unsafe");
    expect(() => buildAuthorization({ txHash: "tx1", chain: "sol\nana" })).toThrow("unsafe");
  });

  it("throws when txHash is empty string (no fields emitted)", () => {
    // TypeScript allows `{ txHash: "" }` — the runtime guard must catch it
    expect(() => buildAuthorization({ txHash: "" })).toThrow("requires at least tx_hash");
  });
});

describe("parseAmount", () => {
  it("parses valid positive float", () => {
    expect(parseAmount({ chain: "s", token: "U", amount: "0.05", address: "a" })).toBe(0.05);
    expect(parseAmount({ chain: "s", token: "U", amount: "100", address: "a" })).toBe(100);
    expect(parseAmount({ chain: "s", token: "U", amount: "0.000001", address: "a" })).toBeCloseTo(0.000001);
  });

  it("throws for zero or negative", () => {
    expect(() => parseAmount({ chain: "s", token: "U", amount: "0", address: "a" })).toThrow();
    expect(() => parseAmount({ chain: "s", token: "U", amount: "-1", address: "a" })).toThrow();
    expect(() => parseAmount({ chain: "s", token: "U", amount: "-0.001", address: "a" })).toThrow();
  });

  it("throws for non-numeric", () => {
    expect(() => parseAmount({ chain: "s", token: "U", amount: "abc", address: "a" })).toThrow();
    expect(() => parseAmount({ chain: "s", token: "U", amount: "", address: "a" })).toThrow();
    expect(() => parseAmount({ chain: "s", token: "U", amount: "0x10", address: "a" })).toThrow(); // hex: parseFloat("0x10")=0 but fails DECIMAL_RE
    expect(() => parseAmount({ chain: "s", token: "U", amount: "1e5", address: "a" })).toThrow(); // scientific notation
    expect(() => parseAmount({ chain: "s", token: "U", amount: "1 extra", address: "a" })).toThrow(); // multi-token injection
  });

  it("throws for Infinity / NaN", () => {
    expect(() => parseAmount({ chain: "s", token: "U", amount: "Infinity", address: "a" })).toThrow();
    expect(() => parseAmount({ chain: "s", token: "U", amount: "-Infinity", address: "a" })).toThrow();
    expect(() => parseAmount({ chain: "s", token: "U", amount: "NaN", address: "a" })).toThrow();
  });
});

describe("descriptorToChallenge", () => {
  it("converts with all fields present", () => {
    const svc = { endpoint: "https://api.example.com", price: "0.05", chain: "solana", token: "USDC", address: "Addr", serviceHash: "hash1" };
    const challenge = descriptorToChallenge(svc);
    expect(challenge.chain).toBe("solana");
    expect(challenge.token).toBe("USDC");
    expect(challenge.amount).toBe("0.05");
    expect(challenge.address).toBe("Addr");
    expect(challenge.serviceHash).toBe("hash1");
  });

  it("defaults chain to 'solana' when absent", () => {
    const svc = { endpoint: "https://api.example.com", price: "0.10" };
    const challenge = descriptorToChallenge(svc);
    expect(challenge.chain).toBe("solana");
  });

  it("defaults token to 'USDC' when absent", () => {
    const svc = { endpoint: "https://api.example.com", price: "0.10" };
    const challenge = descriptorToChallenge(svc);
    expect(challenge.token).toBe("USDC");
  });

  it("defaults address to '' when absent", () => {
    const svc = { endpoint: "https://api.example.com", price: "0.10" };
    const challenge = descriptorToChallenge(svc);
    expect(challenge.address).toBe("");
  });
});
