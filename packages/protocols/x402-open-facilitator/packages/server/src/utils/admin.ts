/**
 * Admin utility functions
 * Parses ADMIN_USER_IDS env var and provides admin check
 */

/**
 * Get the list of admin user IDs from environment variable
 * @returns Array of admin user IDs (trimmed, non-empty)
 */
function getAdminUserIds(): string[] {
  const adminIds = process.env.ADMIN_USER_IDS;
  if (!adminIds) {
    return [];
  }
  return adminIds
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Check if a user ID is an admin
 * @param userId - The user ID to check
 * @returns true if the user is an admin, false otherwise
 */
export function isAdmin(userId: string): boolean {
  const adminIds = getAdminUserIds();
  return adminIds.includes(userId);
}
