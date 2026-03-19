/**
 * Proxy URLs Database Operations
 *
 * URLs that proxy to backend APIs with x402 payment requirements.
 */

import { getDatabase } from './index.js';
import { nanoid } from 'nanoid';

export interface ProxyUrl {
  id: string;
  facilitator_id: string;
  name: string;
  slug: string;
  target_url: string;
  method: string;
  price_amount: string;
  price_asset: string;
  price_network: string;
  pay_to_address: string;
  headers_forward: string; // JSON array
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProxyUrlInput {
  facilitator_id: string;
  name: string;
  slug: string;
  target_url: string;
  method?: string;
  price_amount: string;
  price_asset: string;
  price_network: string;
  pay_to_address: string;
  headers_forward?: string[];
}

export interface UpdateProxyUrlInput {
  name?: string;
  slug?: string;
  target_url?: string;
  method?: string;
  price_amount?: string;
  price_asset?: string;
  price_network?: string;
  pay_to_address?: string;
  headers_forward?: string[];
  active?: boolean;
}

/**
 * Create a new proxy URL
 */
export function createProxyUrl(input: CreateProxyUrlInput): ProxyUrl {
  const db = getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO proxy_urls (
      id, facilitator_id, name, slug, target_url, method,
      price_amount, price_asset, price_network, pay_to_address,
      headers_forward, active, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  stmt.run(
    id,
    input.facilitator_id,
    input.name,
    input.slug,
    input.target_url,
    input.method || 'ANY',
    input.price_amount,
    input.price_asset,
    input.price_network,
    input.pay_to_address,
    JSON.stringify(input.headers_forward || []),
    now,
    now
  );

  return getProxyUrlById(id)!;
}

/**
 * Get proxy URL by ID
 */
export function getProxyUrlById(id: string): ProxyUrl | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM proxy_urls WHERE id = ?');
  return stmt.get(id) as ProxyUrl | null;
}

/**
 * Get proxy URL by facilitator and slug
 */
export function getProxyUrlBySlug(facilitatorId: string, slug: string): ProxyUrl | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM proxy_urls WHERE facilitator_id = ? AND slug = ?');
  return stmt.get(facilitatorId, slug) as ProxyUrl | null;
}

/**
 * Get all proxy URLs for a facilitator
 */
export function getProxyUrlsByFacilitator(facilitatorId: string): ProxyUrl[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM proxy_urls WHERE facilitator_id = ? ORDER BY created_at DESC');
  return stmt.all(facilitatorId) as ProxyUrl[];
}

/**
 * Update a proxy URL
 */
export function updateProxyUrl(id: string, input: UpdateProxyUrlInput): ProxyUrl | null {
  const db = getDatabase();
  const existing = getProxyUrlById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    values.push(input.slug);
  }
  if (input.target_url !== undefined) {
    updates.push('target_url = ?');
    values.push(input.target_url);
  }
  if (input.method !== undefined) {
    updates.push('method = ?');
    values.push(input.method);
  }
  if (input.price_amount !== undefined) {
    updates.push('price_amount = ?');
    values.push(input.price_amount);
  }
  if (input.price_asset !== undefined) {
    updates.push('price_asset = ?');
    values.push(input.price_asset);
  }
  if (input.price_network !== undefined) {
    updates.push('price_network = ?');
    values.push(input.price_network);
  }
  if (input.pay_to_address !== undefined) {
    updates.push('pay_to_address = ?');
    values.push(input.pay_to_address);
  }
  if (input.headers_forward !== undefined) {
    updates.push('headers_forward = ?');
    values.push(JSON.stringify(input.headers_forward));
  }
  if (input.active !== undefined) {
    updates.push('active = ?');
    values.push(input.active ? 1 : 0);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE proxy_urls SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getProxyUrlById(id);
}

/**
 * Delete a proxy URL
 */
export function deleteProxyUrl(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM proxy_urls WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Check if slug is unique for facilitator
 */
export function isSlugUnique(facilitatorId: string, slug: string, excludeId?: string): boolean {
  const db = getDatabase();
  if (excludeId) {
    const stmt = db.prepare('SELECT id FROM proxy_urls WHERE facilitator_id = ? AND slug = ? AND id != ?');
    return !stmt.get(facilitatorId, slug, excludeId);
  }
  const stmt = db.prepare('SELECT id FROM proxy_urls WHERE facilitator_id = ? AND slug = ?');
  return !stmt.get(facilitatorId, slug);
}
