import { readFile } from "fs/promises";
import bs58 from "bs58";

/**
 * Helper script to convert a Solana keypair JSON file to base58 format.
 * This is useful for the CROSSMINT_EXTERNAL_PRIVATE_KEY environment variable.
 */

const keypairPath = process.argv[2] || process.env.PAYER_KEYPAIR_PATH || "./keypairs/payer.json";

try {
  // Read keypair file
  const keypairData = await readFile(keypairPath, "utf-8");
  const secretKey = Uint8Array.from(JSON.parse(keypairData));

  // Convert to base58
  const base58Key = bs58.encode(secretKey);

  console.log("\n=== Keypair to Base58 Converter ===");
  console.log(`Input file: ${keypairPath}`);
  console.log(`Key length: ${secretKey.length} bytes`);
  console.log(`\nBase58-encoded private key:`);
  console.log(base58Key);
  console.log(`\nAdd this to your .env as:`);
  console.log(`CROSSMINT_EXTERNAL_PRIVATE_KEY=${base58Key}`);
  console.log(`\n⚠️  IMPORTANT: Keep this key secure and never commit it to version control!`);
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : String(error));
  console.log(`\nUsage: npm run keypair:base58 [path-to-keypair.json]`);
  console.log(`Default: Uses PAYER_KEYPAIR_PATH from .env`);
  process.exit(1);
}
