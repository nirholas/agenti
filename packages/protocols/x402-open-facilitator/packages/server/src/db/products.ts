import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { ProductRecord, ProductPaymentRecord, RequiredFieldDefinition } from './types.js';

/**
 * Create a new product
 */
export function createProduct(data: {
  facilitator_id: string;
  name: string;
  description?: string;
  image_url?: string;
  slug?: string;
  link_type?: 'payment' | 'redirect' | 'proxy';
  amount: string;
  asset: string;
  network: string;
  pay_to_address: string;
  success_redirect_url?: string;
  method?: string;
  headers_forward?: string[];
  access_ttl?: number;
  required_fields?: RequiredFieldDefinition[];
  group_name?: string;
  webhook_id?: string;
  webhook_url?: string;
  webhook_secret?: string;
}): ProductRecord {
  const db = getDatabase();
  const id = nanoid();
  const slug = data.slug || id; // Default to ID if no slug provided

  const stmt = db.prepare(`
    INSERT INTO products (id, facilitator_id, name, description, image_url, slug, link_type, amount, asset, network, pay_to_address, success_redirect_url, method, headers_forward, access_ttl, required_fields, group_name, webhook_id, webhook_url, webhook_secret)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.facilitator_id,
    data.name,
    data.description || null,
    data.image_url || null,
    slug,
    data.link_type || 'payment',
    data.amount,
    data.asset,
    data.network,
    data.pay_to_address,
    data.success_redirect_url || null,
    data.method || 'GET',
    JSON.stringify(data.headers_forward || []),
    data.access_ttl || 0,
    JSON.stringify(data.required_fields || []),
    data.group_name || null,
    data.webhook_id || null,
    data.webhook_url || null,
    data.webhook_secret || null
  );

  return getProductById(id)!;
}

/**
 * Get a product by ID
 */
export function getProductById(id: string): ProductRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
  return (stmt.get(id) as ProductRecord) || null;
}

/**
 * Get a product by ID or slug
 */
export function getProductByIdOrSlug(facilitatorId: string, idOrSlug: string): ProductRecord | null {
  const db = getDatabase();
  // Try by ID first, then by slug
  const stmt = db.prepare('SELECT * FROM products WHERE (id = ? OR (facilitator_id = ? AND slug = ?))');
  return (stmt.get(idOrSlug, facilitatorId, idOrSlug) as ProductRecord) || null;
}

/**
 * Get a product by slug
 */
export function getProductBySlug(facilitatorId: string, slug: string): ProductRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM products WHERE facilitator_id = ? AND slug = ?');
  return (stmt.get(facilitatorId, slug) as ProductRecord) || null;
}

/**
 * Check if slug is unique for facilitator
 */
export function isProductSlugUnique(facilitatorId: string, slug: string, excludeId?: string): boolean {
  const db = getDatabase();
  if (excludeId) {
    const stmt = db.prepare('SELECT id FROM products WHERE facilitator_id = ? AND slug = ? AND id != ?');
    return !stmt.get(facilitatorId, slug, excludeId);
  }
  const stmt = db.prepare('SELECT id FROM products WHERE facilitator_id = ? AND slug = ?');
  return !stmt.get(facilitatorId, slug);
}

/**
 * Get all products for a facilitator
 */
export function getProductsByFacilitator(facilitatorId: string): ProductRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM products WHERE facilitator_id = ? ORDER BY created_at DESC');
  return stmt.all(facilitatorId) as ProductRecord[];
}

/**
 * Get active products for a facilitator
 */
export function getActiveProducts(facilitatorId: string): ProductRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM products WHERE facilitator_id = ? AND active = 1 ORDER BY created_at DESC');
  return stmt.all(facilitatorId) as ProductRecord[];
}

/**
 * Get products by group name
 */
export function getProductsByGroup(facilitatorId: string, groupName: string): ProductRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM products WHERE facilitator_id = ? AND group_name = ? ORDER BY created_at DESC');
  return stmt.all(facilitatorId, groupName) as ProductRecord[];
}

/**
 * Get distinct group names for a facilitator
 */
export function getProductGroups(facilitatorId: string): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT DISTINCT group_name FROM products WHERE facilitator_id = ? AND group_name IS NOT NULL ORDER BY group_name');
  const results = stmt.all(facilitatorId) as { group_name: string }[];
  return results.map(r => r.group_name);
}

/**
 * Update a product
 */
export function updateProduct(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    image_url: string | null;
    slug: string;
    link_type: 'payment' | 'redirect' | 'proxy';
    amount: string;
    asset: string;
    network: string;
    pay_to_address: string;
    success_redirect_url: string | null;
    method: string;
    headers_forward: string[];
    access_ttl: number;
    required_fields: RequiredFieldDefinition[];
    group_name: string | null;
    webhook_id: string | null;
    webhook_url: string | null;
    webhook_secret: string | null;
    active: number;
  }>
): ProductRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.image_url !== undefined) {
    fields.push('image_url = ?');
    values.push(updates.image_url);
  }
  if (updates.slug !== undefined) {
    fields.push('slug = ?');
    values.push(updates.slug);
  }
  if (updates.link_type !== undefined) {
    fields.push('link_type = ?');
    values.push(updates.link_type);
  }
  if (updates.amount !== undefined) {
    fields.push('amount = ?');
    values.push(updates.amount);
  }
  if (updates.asset !== undefined) {
    fields.push('asset = ?');
    values.push(updates.asset);
  }
  if (updates.network !== undefined) {
    fields.push('network = ?');
    values.push(updates.network);
  }
  if (updates.pay_to_address !== undefined) {
    fields.push('pay_to_address = ?');
    values.push(updates.pay_to_address);
  }
  if (updates.success_redirect_url !== undefined) {
    fields.push('success_redirect_url = ?');
    values.push(updates.success_redirect_url);
  }
  if (updates.method !== undefined) {
    fields.push('method = ?');
    values.push(updates.method);
  }
  if (updates.headers_forward !== undefined) {
    fields.push('headers_forward = ?');
    values.push(JSON.stringify(updates.headers_forward));
  }
  if (updates.access_ttl !== undefined) {
    fields.push('access_ttl = ?');
    values.push(updates.access_ttl);
  }
  if (updates.required_fields !== undefined) {
    fields.push('required_fields = ?');
    values.push(JSON.stringify(updates.required_fields));
  }
  if (updates.group_name !== undefined) {
    fields.push('group_name = ?');
    values.push(updates.group_name);
  }
  if (updates.webhook_id !== undefined) {
    fields.push('webhook_id = ?');
    values.push(updates.webhook_id);
  }
  if (updates.webhook_url !== undefined) {
    fields.push('webhook_url = ?');
    values.push(updates.webhook_url);
  }
  if (updates.webhook_secret !== undefined) {
    fields.push('webhook_secret = ?');
    values.push(updates.webhook_secret);
  }
  if (updates.active !== undefined) {
    fields.push('active = ?');
    values.push(updates.active);
  }

  if (fields.length === 0) {
    return getProductById(id);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getProductById(id);
}

/**
 * Delete a product
 */
export function deleteProduct(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM products WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Record a payment for a product
 */
export function createProductPayment(data: {
  product_id: string;
  payer_address: string;
  amount: string;
  transaction_hash?: string;
  status: 'pending' | 'success' | 'failed';
  error_message?: string;
  metadata?: Record<string, unknown>;
}): ProductPaymentRecord {
  const db = getDatabase();
  const id = nanoid();

  const stmt = db.prepare(`
    INSERT INTO product_payments (id, product_id, payer_address, amount, transaction_hash, status, error_message, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.product_id,
    data.payer_address,
    data.amount,
    data.transaction_hash || null,
    data.status,
    data.error_message || null,
    JSON.stringify(data.metadata || {})
  );

  return getProductPaymentById(id)!;
}

/**
 * Get a product payment by ID
 */
export function getProductPaymentById(id: string): ProductPaymentRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM product_payments WHERE id = ?');
  return (stmt.get(id) as ProductPaymentRecord) || null;
}

/**
 * Get all payments for a product
 */
export function getProductPayments(productId: string, limit = 50, offset = 0): ProductPaymentRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM product_payments WHERE product_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
  return stmt.all(productId, limit, offset) as ProductPaymentRecord[];
}

/**
 * Update a product payment status
 */
export function updateProductPaymentStatus(
  id: string,
  status: 'pending' | 'success' | 'failed',
  transactionHash?: string,
  errorMessage?: string
): ProductPaymentRecord | null {
  const db = getDatabase();

  const fields: string[] = ['status = ?'];
  const values: (string | null)[] = [status];

  if (transactionHash !== undefined) {
    fields.push('transaction_hash = ?');
    values.push(transactionHash);
  }
  if (errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(errorMessage);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE product_payments SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getProductPaymentById(id);
}

/**
 * Get product stats
 */
export function getProductStats(productId: string): {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalAmountCollected: string;
} {
  const db = getDatabase();

  const statsStmt = db.prepare(`
    SELECT
      COUNT(*) as total_payments,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_payments,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
      COALESCE(SUM(CASE WHEN status = 'success' THEN CAST(amount AS INTEGER) ELSE 0 END), 0) as total_amount
    FROM product_payments
    WHERE product_id = ?
  `);

  const result = statsStmt.get(productId) as {
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: number;
  };

  return {
    totalPayments: result.total_payments || 0,
    successfulPayments: result.successful_payments || 0,
    failedPayments: result.failed_payments || 0,
    totalAmountCollected: String(result.total_amount || 0),
  };
}

/**
 * Get products stats for a facilitator (aggregate)
 */
export function getFacilitatorProductsStats(facilitatorId: string): {
  totalProducts: number;
  activeProducts: number;
  totalPayments: number;
  totalAmountCollected: string;
} {
  const db = getDatabase();

  const productsStmt = db.prepare(`
    SELECT
      COUNT(*) as total_products,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_products
    FROM products
    WHERE facilitator_id = ?
  `);

  const productsResult = productsStmt.get(facilitatorId) as {
    total_products: number;
    active_products: number;
  };

  const paymentsStmt = db.prepare(`
    SELECT
      COUNT(*) as total_payments,
      COALESCE(SUM(CASE WHEN pp.status = 'success' THEN CAST(pp.amount AS INTEGER) ELSE 0 END), 0) as total_amount
    FROM product_payments pp
    JOIN products p ON pp.product_id = p.id
    WHERE p.facilitator_id = ?
  `);

  const paymentsResult = paymentsStmt.get(facilitatorId) as {
    total_payments: number;
    total_amount: number;
  };

  return {
    totalProducts: productsResult.total_products || 0,
    activeProducts: productsResult.active_products || 0,
    totalPayments: paymentsResult.total_payments || 0,
    totalAmountCollected: String(paymentsResult.total_amount || 0),
  };
}

// Backwards compatibility aliases (deprecated)
// These map the old PaymentLink names to the new Product names

/** @deprecated Use createProduct instead */
export const createPaymentLink = createProduct;
/** @deprecated Use getProductById instead */
export const getPaymentLinkById = getProductById;
/** @deprecated Use getProductByIdOrSlug instead */
export const getPaymentLinkByIdOrSlug = getProductByIdOrSlug;
/** @deprecated Use getProductBySlug instead */
export const getPaymentLinkBySlug = getProductBySlug;
/** @deprecated Use isProductSlugUnique instead */
export const isSlugUnique = isProductSlugUnique;
/** @deprecated Use getProductsByFacilitator instead */
export const getPaymentLinksByFacilitator = getProductsByFacilitator;
/** @deprecated Use getActiveProducts instead */
export const getActivePaymentLinks = getActiveProducts;
/** @deprecated Use updateProduct instead */
export const updatePaymentLink = updateProduct;
/** @deprecated Use deleteProduct instead */
export const deletePaymentLink = deleteProduct;
/** @deprecated Use createProductPayment instead */
export const createPaymentLinkPayment = createProductPayment;
/** @deprecated Use getProductPaymentById instead */
export const getPaymentLinkPaymentById = getProductPaymentById;
/** @deprecated Use getProductPayments instead */
export const getPaymentLinkPayments = getProductPayments;
/** @deprecated Use updateProductPaymentStatus instead */
export const updatePaymentLinkPaymentStatus = updateProductPaymentStatus;
/** @deprecated Use getProductStats instead */
export const getPaymentLinkStats = getProductStats;
/** @deprecated Use getFacilitatorProductsStats instead */
export const getFacilitatorPaymentLinksStats = getFacilitatorProductsStats;
