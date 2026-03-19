import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { getDatabase } from './index.js';
import type { RegisteredServerRecord } from './types.js';

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create a registered server and return the plaintext API key
 */
export function createRegisteredServer(data: {
  resource_owner_id: string;
  url?: string;
  name?: string;
}): { server: RegisteredServerRecord; apiKey: string } {
  const db = getDatabase();
  const id = nanoid();
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  // Use empty string for URL if not provided (legacy schema requires non-null)
  const url = data.url || '';

  const stmt = db.prepare(`
    INSERT INTO registered_servers (id, resource_owner_id, url, name, api_key_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, data.resource_owner_id, url, data.name || null, apiKeyHash);

  const server = getRegisteredServerById(id)!;
  return { server, apiKey };
}

/**
 * Get a registered server by ID
 */
export function getRegisteredServerById(id: string): RegisteredServerRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM registered_servers WHERE id = ?');
  return (stmt.get(id) as RegisteredServerRecord) || null;
}

/**
 * Get all registered servers for a resource owner
 */
export function getRegisteredServersByResourceOwner(resourceOwnerId: string): RegisteredServerRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM registered_servers WHERE resource_owner_id = ? ORDER BY created_at DESC');
  return stmt.all(resourceOwnerId) as RegisteredServerRecord[];
}

/**
 * Get a registered server by API key hash
 */
export function getRegisteredServerByApiKeyHash(hash: string): RegisteredServerRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM registered_servers WHERE api_key_hash = ? AND active = 1');
  return (stmt.get(hash) as RegisteredServerRecord) || null;
}

/**
 * Get a registered server by API key (hashes the key first)
 */
export function getRegisteredServerByApiKey(apiKey: string): RegisteredServerRecord | null {
  const hash = hashApiKey(apiKey);
  return getRegisteredServerByApiKeyHash(hash);
}

/**
 * Update a registered server
 */
export function updateRegisteredServer(
  id: string,
  updates: Partial<{ name: string; url: string; active: number }>
): RegisteredServerRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    fields.push('url = ?');
    values.push(updates.url);
  }
  if (updates.active !== undefined) {
    fields.push('active = ?');
    values.push(updates.active);
  }

  if (fields.length === 0) {
    return getRegisteredServerById(id);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE registered_servers SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getRegisteredServerById(id);
}

/**
 * Delete a registered server
 */
export function deleteRegisteredServer(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM registered_servers WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Regenerate API key for a server
 */
export function regenerateServerApiKey(id: string): { server: RegisteredServerRecord; apiKey: string } | null {
  const db = getDatabase();
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const stmt = db.prepare('UPDATE registered_servers SET api_key_hash = ? WHERE id = ?');
  const result = stmt.run(apiKeyHash, id);

  if (result.changes === 0) {
    return null;
  }

  const server = getRegisteredServerById(id)!;
  return { server, apiKey };
}

/**
 * Get server stats for a resource owner
 */
export function getRegisteredServerStats(resourceOwnerId: string): {
  totalServers: number;
  activeServers: number;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_servers,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_servers
    FROM registered_servers
    WHERE resource_owner_id = ?
  `);

  const result = stmt.get(resourceOwnerId) as {
    total_servers: number;
    active_servers: number;
  };

  return {
    totalServers: result.total_servers || 0,
    activeServers: result.active_servers || 0,
  };
}

// Legacy aliases for backwards compatibility
/** @deprecated Use getRegisteredServersByResourceOwner */
export const getRegisteredServersByFacilitator = getRegisteredServersByResourceOwner;
