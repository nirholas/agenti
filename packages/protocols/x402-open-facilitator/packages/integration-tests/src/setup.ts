import { config } from 'dotenv';

// Load environment variables
config();

// Test configuration
export const TEST_CONFIG = {
  // Endpoints to test
  FREE_ENDPOINT: process.env.TEST_ENDPOINT || 'https://pay.openfacilitator.io',
  CUSTOM_DOMAIN: process.env.TEST_CUSTOM_DOMAIN || 'https://pay.x402.jobs',
  
  // Test wallet (Solana) - set via env or use a test wallet
  // WARNING: Only use this wallet for testing with small amounts!
  SOLANA_PRIVATE_KEY: process.env.TEST_SOLANA_PRIVATE_KEY,
  
  // Test configuration
  TIMEOUT: 30000,
};

// Validate that endpoints are accessible
export async function validateEndpoint(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/supported`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

