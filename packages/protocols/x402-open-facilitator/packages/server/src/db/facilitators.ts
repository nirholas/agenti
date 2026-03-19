import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { FacilitatorRecord } from './types.js';
import { createFacilitatorMarker } from './reward-addresses.js';
import { getActiveSubscription, createSubscription, extendSubscription } from './subscriptions.js';

/**
 * Create a new facilitator
 * Also creates/extends a subscription for the owner (each facilitator = $5/month)
 */
export function createFacilitator(data: {
  name: string;
  subdomain: string;
  custom_domain?: string;
  owner_address: string;
  supported_chains: string;
  supported_tokens: string;
  encrypted_private_key?: string;
}): FacilitatorRecord | null {
  const db = getDatabase();
  const id = nanoid();

  try {
    const stmt = db.prepare(`
      INSERT INTO facilitators (id, name, subdomain, custom_domain, owner_address, supported_chains, supported_tokens, encrypted_private_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.subdomain.toLowerCase(),
      data.custom_domain?.toLowerCase() || null,
      data.owner_address.toLowerCase(),
      data.supported_chains,
      data.supported_tokens,
      data.encrypted_private_key || null
    );

    const facilitator = getFacilitatorById(id);

    // Create or extend subscription for the facilitator owner
    // This ensures the billing cron will process their payment
    if (facilitator) {
      // Get the actual user ID from the database (preserves case for FK constraint)
      const userStmt = db.prepare(`SELECT id FROM "user" WHERE LOWER(id) = ? LIMIT 1`);
      const userRecord = userStmt.get(data.owner_address.toLowerCase()) as { id: string } | undefined;

      if (userRecord) {
        const userId = userRecord.id;
        const existingSubscription = getActiveSubscription(userId);

        if (!existingSubscription) {
          // Create new subscription with 30-day expiration
          // First payment is due immediately, so set expires to now + 30 days
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          createSubscription(userId, 'starter', expiresAt, null, 0); // amount=0, no tx yet
        }
      }
    }

    return facilitator;
  } catch (error: unknown) {
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get a facilitator by ID
 */
export function getFacilitatorById(id: string): FacilitatorRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM facilitators WHERE id = ?');
  return (stmt.get(id) as FacilitatorRecord) || null;
}

/**
 * Get a facilitator by subdomain
 */
export function getFacilitatorBySubdomain(subdomain: string): FacilitatorRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM facilitators WHERE subdomain = ?');
  return (stmt.get(subdomain.toLowerCase()) as FacilitatorRecord) || null;
}

/**
 * Get a facilitator by custom domain (checks both custom_domain and additional_domains)
 */
export function getFacilitatorByCustomDomain(domain: string): FacilitatorRecord | null {
  const db = getDatabase();
  const normalizedDomain = domain.toLowerCase();
  
  // First try exact match on custom_domain
  const stmt = db.prepare('SELECT * FROM facilitators WHERE custom_domain = ?');
  const result = stmt.get(normalizedDomain) as FacilitatorRecord | undefined;
  if (result) {
    return result;
  }
  
  // Then check additional_domains (JSON array)
  const allFacilitators = db.prepare('SELECT * FROM facilitators WHERE additional_domains != \'[]\'').all() as FacilitatorRecord[];
  for (const facilitator of allFacilitators) {
    try {
      const additionalDomains = JSON.parse(facilitator.additional_domains || '[]') as string[];
      if (additionalDomains.map(d => d.toLowerCase()).includes(normalizedDomain)) {
        return facilitator;
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  
  return null;
}

/**
 * Get all facilitators for an owner address
 */
export function getFacilitatorsByOwner(ownerAddress: string): FacilitatorRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM facilitators WHERE owner_address = ? ORDER BY created_at DESC');
  return stmt.all(ownerAddress.toLowerCase()) as FacilitatorRecord[];
}

/**
 * Update a facilitator
 */
export function updateFacilitator(
  id: string,
  updates: Partial<{
    name: string;
    custom_domain: string;
    additional_domains: string;
    supported_chains: string;
    supported_tokens: string;
    encrypted_private_key: string;
    encrypted_solana_private_key: string;
    encrypted_stacks_private_key: string;
    favicon: string | null;
    webhook_url: string;
    webhook_secret: string;
  }>
): FacilitatorRecord | null {
  const db = getDatabase();

  // Build dynamic update query
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.custom_domain !== undefined) {
    fields.push('custom_domain = ?');
    values.push(updates.custom_domain || null);
  }
  if (updates.additional_domains !== undefined) {
    fields.push('additional_domains = ?');
    values.push(updates.additional_domains);
  }
  if (updates.supported_chains !== undefined) {
    fields.push('supported_chains = ?');
    values.push(updates.supported_chains);
  }
  if (updates.supported_tokens !== undefined) {
    fields.push('supported_tokens = ?');
    values.push(updates.supported_tokens);
  }
  if (updates.encrypted_private_key !== undefined) {
    fields.push('encrypted_private_key = ?');
    values.push(updates.encrypted_private_key);
  }
  if (updates.encrypted_solana_private_key !== undefined) {
    fields.push('encrypted_solana_private_key = ?');
    values.push(updates.encrypted_solana_private_key);
  }
  if (updates.encrypted_stacks_private_key !== undefined) {
    fields.push('encrypted_stacks_private_key = ?');
    values.push(updates.encrypted_stacks_private_key);
  }
  if (updates.favicon !== undefined) {
    fields.push('favicon = ?');
    values.push(updates.favicon);
  }
  if (updates.webhook_url !== undefined) {
    fields.push('webhook_url = ?');
    values.push(updates.webhook_url || null);
  }
  if (updates.webhook_secret !== undefined) {
    fields.push('webhook_secret = ?');
    values.push(updates.webhook_secret || null);
  }

  if (fields.length === 0) {
    return getFacilitatorById(id);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE facilitators SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getFacilitatorById(id);
}

/**
 * Delete a facilitator
 */
export function deleteFacilitator(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM facilitators WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Check if a subdomain is available
 */
export function isSubdomainAvailable(subdomain: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT 1 FROM facilitators WHERE subdomain = ?');
  return !stmt.get(subdomain.toLowerCase());
}

/**
 * Get a facilitator by domain or subdomain (for backward compatibility)
 * Tries custom domain first, then subdomain as fallback
 */
export function getFacilitatorByDomainOrSubdomain(identifier: string): FacilitatorRecord | null {
  // First try as a domain (custom_domain or additional_domains)
  const byDomain = getFacilitatorByCustomDomain(identifier);
  if (byDomain) {
    return byDomain;
  }

  // Fall back to subdomain lookup for backward compatibility
  return getFacilitatorBySubdomain(identifier);
}

/**
 * Check if a user owns at least one facilitator
 * @param userId - The user ID to check (stored as lowercase in owner_address)
 * @returns true if user owns at least one facilitator, false otherwise
 */
export function isFacilitatorOwner(userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT 1 FROM facilitators WHERE owner_address = ? LIMIT 1');
  return stmt.get(userId.toLowerCase()) !== undefined;
}

/**
 * Ensure a facilitator owner has an enrollment marker for volume tracking
 * Creates the marker if it doesn't exist, using the earliest facilitator's created_at
 * as the enrollment date.
 *
 * @param userId - The facilitator owner's user ID
 * @returns The created marker record, or null if marker already exists or user doesn't exist
 */
export function ensureFacilitatorMarker(userId: string): ReturnType<typeof createFacilitatorMarker> {
  const db = getDatabase();
  const normalizedUserId = userId.toLowerCase();

  // Check if user exists in the user table (required for foreign key constraint)
  // Use case-insensitive comparison since user IDs may have mixed case
  const userExistsStmt = db.prepare(`
    SELECT id FROM "user" WHERE LOWER(id) = ? LIMIT 1
  `);
  const userRecord = userExistsStmt.get(normalizedUserId) as { id: string } | undefined;
  if (!userRecord) {
    return null; // User doesn't exist in user table
  }
  const actualUserId = userRecord.id; // Use the actual case from DB

  // Check if marker already exists (use actual user ID for FK consistency)
  const existingStmt = db.prepare(`
    SELECT 1 FROM reward_addresses
    WHERE user_id = ? AND chain_type = 'facilitator'
    LIMIT 1
  `);
  if (existingStmt.get(actualUserId)) {
    return null; // Marker already exists
  }

  // Find the user's earliest facilitator by created_at
  // Use lowercase for owner_address comparison (facilitators store lowercase)
  const earliestStmt = db.prepare(`
    SELECT created_at FROM facilitators
    WHERE owner_address = ?
    ORDER BY created_at ASC
    LIMIT 1
  `);
  const earliest = earliestStmt.get(normalizedUserId) as { created_at: string } | undefined;

  if (!earliest) {
    return null; // User doesn't own any facilitators
  }

  // Create the marker with the actual user ID (for FK constraint) and earliest date
  return createFacilitatorMarker(actualUserId, earliest.created_at);
}

/**
 * Backfill missing facilitator enrollment markers for all existing owners
 * Safe to run multiple times - ensureFacilitatorMarker is idempotent
 * @returns Number of markers created
 */
export function backfillFacilitatorMarkers(): number {
  const db = getDatabase();

  // Find all unique facilitator owners
  const stmt = db.prepare(`
    SELECT DISTINCT owner_address
    FROM facilitators
  `);
  const owners = stmt.all() as { owner_address: string }[];

  let created = 0;
  for (const { owner_address } of owners) {
    const result = ensureFacilitatorMarker(owner_address);
    if (result) created++;
  }

  return created;
}

/**
 * Backfill subscriptions for existing facilitator owners who don't have one
 * Safe to run multiple times - only creates if no active subscription exists
 * @returns Number of subscriptions created
 */
export function backfillFacilitatorSubscriptions(): number {
  const db = getDatabase();

  // Find all unique facilitator owners that have a valid user record
  // Join with user table to ensure foreign key constraint is satisfied
  const stmt = db.prepare(`
    SELECT DISTINCT f.owner_address, u.id as user_id
    FROM facilitators f
    INNER JOIN "user" u ON LOWER(u.id) = f.owner_address
  `);
  const owners = stmt.all() as { owner_address: string; user_id: string }[];

  let created = 0;
  for (const { user_id } of owners) {
    const existingSubscription = getActiveSubscription(user_id);

    if (!existingSubscription) {
      // Create subscription expiring in 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      createSubscription(user_id, 'starter', expiresAt, null, 0);
      created++;
      console.log(`[Backfill] Created subscription for facilitator owner: ${user_id}`);
    }
  }

  return created;
}
