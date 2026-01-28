import { UserProfile, ChainId } from '../types';

// In production, this would be a database
const usernameRegistry = new Map<string, UserProfile>();
const addressToUsername = new Map<string, string>();

/**
 * Register a username (X handle) to a wallet address
 * Requires prior X OAuth verification
 */
export async function registerUsername(
  username: string,
  walletAddress: string,
  xVerificationToken: string
): Promise<UserProfile> {
  // Normalize username (lowercase, no @)
  const normalizedUsername = normalizeUsername(username);
  
  // Verify the X handle ownership
  const isVerified = await verifyXOwnership(normalizedUsername, xVerificationToken);
  if (!isVerified) {
    throw new Error('X handle verification failed');
  }
  
  // Check if username is already taken
  if (usernameRegistry.has(normalizedUsername)) {
    const existing = usernameRegistry.get(normalizedUsername)!;
    if (existing.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Username already registered to another wallet');
    }
  }
  
  // Check if address already has a username
  const existingUsername = addressToUsername.get(walletAddress.toLowerCase());
  if (existingUsername && existingUsername !== normalizedUsername) {
    // Remove old username
    usernameRegistry.delete(existingUsername);
  }
  
  const profile: UserProfile = {
    walletAddress: walletAddress.toLowerCase(),
    username: normalizedUsername,
    xVerified: true,
    defaultChainId: 1,
    totalReceived: '0',
    createdAt: new Date(),
  };
  
  usernameRegistry.set(normalizedUsername, profile);
  addressToUsername.set(walletAddress.toLowerCase(), normalizedUsername);
  
  return profile;
}

/**
 * Resolve username to wallet address
 */
export function resolveUsername(username: string): string | null {
  const normalized = normalizeUsername(username);
  const profile = usernameRegistry.get(normalized);
  return profile?.walletAddress || null;
}

/**
 * Get profile by wallet address
 */
export function getProfileByAddress(address: string): UserProfile | null {
  const username = addressToUsername.get(address.toLowerCase());
  if (!username) return null;
  return usernameRegistry.get(username) || null;
}

/**
 * Get profile by username
 */
export function getProfileByUsername(username: string): UserProfile | null {
  const normalized = normalizeUsername(username);
  return usernameRegistry.get(normalized) || null;
}

/**
 * Update user's default chain
 */
export function updateDefaultChain(
  walletAddress: string,
  chainId: ChainId
): UserProfile | null {
  const profile = getProfileByAddress(walletAddress);
  if (!profile) return null;
  
  profile.defaultChainId = chainId;
  return profile;
}

/**
 * Record received payment
 */
export function recordPaymentReceived(
  walletAddress: string,
  usdcAmount: string
): void {
  const profile = getProfileByAddress(walletAddress);
  if (profile) {
    const current = BigInt(profile.totalReceived);
    const added = BigInt(usdcAmount);
    profile.totalReceived = (current + added).toString();
  }
}

/**
 * Normalize username: lowercase, remove @ prefix
 */
function normalizeUsername(username: string): string {
  return username.toLowerCase().replace(/^@/, '');
}

/**
 * Verify X (Twitter) handle ownership via OAuth
 */
async function verifyXOwnership(
  username: string,
  verificationToken: string
): Promise<boolean> {
  // In production, this would:
  // 1. Validate the OAuth token
  // 2. Fetch the user's X profile
  // 3. Confirm the username matches
  
  // Placeholder for OAuth verification
  if (!verificationToken) {
    return false;
  }
  
  try {
    // Example X API call (would use actual OAuth in production)
    // const response = await fetch('https://api.twitter.com/2/users/me', {
    //   headers: { Authorization: `Bearer ${verificationToken}` }
    // });
    // const data = await response.json();
    // return data.data.username.toLowerCase() === username;
    
    return true; // Placeholder
  } catch {
    return false;
  }
}

/**
 * Search usernames (for autocomplete)
 */
export function searchUsernames(query: string, limit: number = 10): UserProfile[] {
  const normalized = normalizeUsername(query);
  const results: UserProfile[] = [];
  
  for (const [username, profile] of usernameRegistry) {
    if (username.startsWith(normalized)) {
      results.push(profile);
      if (results.length >= limit) break;
    }
  }
  
  return results;
}
