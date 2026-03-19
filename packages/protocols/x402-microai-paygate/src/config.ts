import { ethers } from "ethers";

const serverPrivateKey = process.env.SERVER_WALLET_PRIVATE_KEY || "";
const recipientEnv = process.env.RECIPIENT_ADDRESS || "";

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "z-ai/glm-4.5-air:free",

  // Server wallet private key for signing/facilitating (if needed) or just identifying the recipient
  SERVER_PRIVATE_KEY: serverPrivateKey,
  CHAIN_ID: parseInt(process.env.CHAIN_ID || "8453"), // Base

  // Payment details
  PAYMENT: {
    TOKEN_SYMBOL: "USDC",
    // USDC contract address - defaults to Base USDC if not specified
    TOKEN_ADDRESS: process.env.USDC_TOKEN_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", //dummy address btw :)
    DEFAULT_PRICE: process.env.PAYMENT_AMOUNT || "0.001", //dummy
    RECIPIENT_ADDRESS: "",
  }
};

// Derive recipient address from private key if a valid hex key is provided; otherwise fall back to env or warn.
if (serverPrivateKey) {
  if (ethers.isHexString(serverPrivateKey, 32)) {
    const wallet = new ethers.Wallet(serverPrivateKey);
    CONFIG.PAYMENT.RECIPIENT_ADDRESS = wallet.address;
  } else {
    console.warn("SERVER_WALLET_PRIVATE_KEY is set but not a valid 32-byte hex string. Skipping wallet derivation.");
  }
}

if (!CONFIG.PAYMENT.RECIPIENT_ADDRESS) {
  if (recipientEnv) {
    CONFIG.PAYMENT.RECIPIENT_ADDRESS = recipientEnv;
  } else {
    console.warn("No valid SERVER_WALLET_PRIVATE_KEY or RECIPIENT_ADDRESS provided. Payment verification may fail.");
  }
}
