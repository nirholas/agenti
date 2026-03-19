/**
 * Storefronts Database Module
 *
 * Storefronts are collections of products - like a catalog or store page.
 * They provide a discovery endpoint for both humans (browsable page) and
 * agents (JSON product list).
 */

import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { StorefrontRecord, StorefrontProductRecord, ProductRecord } from './types.js';

// =============================================================================
// Storefront CRUD
// =============================================================================

export interface CreateStorefrontInput {
  facilitator_id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
}

export function createStorefront(input: CreateStorefrontInput): StorefrontRecord {
  const db = getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO storefronts (id, facilitator_id, name, slug, description, image_url, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  stmt.run(
    id,
    input.facilitator_id,
    input.name,
    input.slug,
    input.description || null,
    input.image_url || null,
    now,
    now
  );

  return getStorefrontById(id)!;
}

export function getStorefrontById(id: string): StorefrontRecord | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM storefronts WHERE id = ?');
  return stmt.get(id) as StorefrontRecord | undefined;
}

export function getStorefrontBySlug(facilitatorId: string, slug: string): StorefrontRecord | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM storefronts WHERE facilitator_id = ? AND slug = ?');
  return stmt.get(facilitatorId, slug) as StorefrontRecord | undefined;
}

export function getStorefrontsByFacilitator(facilitatorId: string): StorefrontRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM storefronts WHERE facilitator_id = ? ORDER BY created_at DESC');
  return stmt.all(facilitatorId) as StorefrontRecord[];
}

export interface UpdateStorefrontInput {
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  active?: boolean;
}

export function updateStorefront(id: string, updates: UpdateStorefrontInput): StorefrontRecord | undefined {
  const db = getDatabase();
  const current = getStorefrontById(id);
  if (!current) return undefined;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.slug !== undefined) {
    fields.push('slug = ?');
    values.push(updates.slug);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.image_url !== undefined) {
    fields.push('image_url = ?');
    values.push(updates.image_url);
  }
  if (updates.active !== undefined) {
    fields.push('active = ?');
    values.push(updates.active ? 1 : 0);
  }

  if (fields.length === 0) return current;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE storefronts SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getStorefrontById(id);
}

export function deleteStorefront(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM storefronts WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function isStorefrontSlugUnique(facilitatorId: string, slug: string, excludeId?: string): boolean {
  const db = getDatabase();
  let stmt;
  if (excludeId) {
    stmt = db.prepare('SELECT COUNT(*) as count FROM storefronts WHERE facilitator_id = ? AND slug = ? AND id != ?');
    const result = stmt.get(facilitatorId, slug, excludeId) as { count: number };
    return result.count === 0;
  }
  stmt = db.prepare('SELECT COUNT(*) as count FROM storefronts WHERE facilitator_id = ? AND slug = ?');
  const result = stmt.get(facilitatorId, slug) as { count: number };
  return result.count === 0;
}

// =============================================================================
// Storefront-Product Association
// =============================================================================

export function addProductToStorefront(storefrontId: string, productId: string, position?: number): StorefrontProductRecord {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Get max position if not specified
  let pos = position;
  if (pos === undefined) {
    const maxStmt = db.prepare('SELECT MAX(position) as max_pos FROM storefront_products WHERE storefront_id = ?');
    const result = maxStmt.get(storefrontId) as { max_pos: number | null };
    pos = (result.max_pos ?? -1) + 1;
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO storefront_products (storefront_id, product_id, position, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(storefrontId, productId, pos, now);

  return {
    storefront_id: storefrontId,
    product_id: productId,
    position: pos,
    created_at: now,
  };
}

export function removeProductFromStorefront(storefrontId: string, productId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM storefront_products WHERE storefront_id = ? AND product_id = ?');
  const result = stmt.run(storefrontId, productId);
  return result.changes > 0;
}

export function updateProductPosition(storefrontId: string, productId: string, position: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE storefront_products SET position = ? WHERE storefront_id = ? AND product_id = ?');
  const result = stmt.run(position, storefrontId, productId);
  return result.changes > 0;
}

export function getStorefrontProducts(storefrontId: string): ProductRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT p.* FROM products p
    INNER JOIN storefront_products sp ON p.id = sp.product_id
    WHERE sp.storefront_id = ? AND p.active = 1
    ORDER BY sp.position ASC
  `);
  return stmt.all(storefrontId) as ProductRecord[];
}

export function getStorefrontProductIds(storefrontId: string): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT product_id FROM storefront_products WHERE storefront_id = ? ORDER BY position ASC');
  const rows = stmt.all(storefrontId) as { product_id: string }[];
  return rows.map(r => r.product_id);
}

export function getProductStorefronts(productId: string): StorefrontRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT s.* FROM storefronts s
    INNER JOIN storefront_products sp ON s.id = sp.storefront_id
    WHERE sp.product_id = ?
    ORDER BY s.name ASC
  `);
  return stmt.all(productId) as StorefrontRecord[];
}

// =============================================================================
// Storefront Stats
// =============================================================================

export interface StorefrontStats {
  totalProducts: number;
  activeProducts: number;
}

export function getStorefrontStats(storefrontId: string): StorefrontStats {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_products,
      SUM(CASE WHEN p.active = 1 THEN 1 ELSE 0 END) as active_products
    FROM storefront_products sp
    INNER JOIN products p ON sp.product_id = p.id
    WHERE sp.storefront_id = ?
  `);
  const result = stmt.get(storefrontId) as { total_products: number; active_products: number };
  return {
    totalProducts: result.total_products || 0,
    activeProducts: result.active_products || 0,
  };
}

export function getFacilitatorStorefrontsStats(facilitatorId: string): {
  totalStorefronts: number;
  activeStorefronts: number;
} {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_storefronts,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_storefronts
    FROM storefronts
    WHERE facilitator_id = ?
  `);
  const result = stmt.get(facilitatorId) as { total_storefronts: number; active_storefronts: number };
  return {
    totalStorefronts: result.total_storefronts || 0,
    activeStorefronts: result.active_storefronts || 0,
  };
}
