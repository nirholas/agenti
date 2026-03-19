import { randomUUID } from 'crypto';
import { getDatabase } from './index.js';

export interface UserPreference {
  id: string;
  user_id: string;
  preferred_chain: 'base' | 'solana';
  created_at: string;
  updated_at: string;
}

/**
 * Get user's chain preference
 */
export function getUserPreference(userId: string): UserPreference | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
  const preference = stmt.get(userId) as UserPreference | undefined;
  return preference || null;
}

/**
 * Create or update user's chain preference
 */
export function upsertUserPreference(
  userId: string,
  preferredChain: 'base' | 'solana'
): UserPreference {
  const db = getDatabase();

  // Check if preference exists
  const existing = getUserPreference(userId);

  if (existing) {
    // Update existing preference
    const stmt = db.prepare(`
      UPDATE user_preferences
      SET preferred_chain = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `);
    stmt.run(preferredChain, userId);
    return getUserPreference(userId)!;
  }

  // Create new preference
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO user_preferences (id, user_id, preferred_chain)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, userId, preferredChain);

  return getUserPreference(userId)!;
}
