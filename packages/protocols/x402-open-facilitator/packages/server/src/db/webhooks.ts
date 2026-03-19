import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { getDatabase } from './index.js';
import type { WebhookRecord } from './types.js';

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Create a new webhook
 */
export function createWebhook(data: {
  facilitator_id: string;
  name: string;
  url: string;
  events?: string[];
  action_type?: string | null;
}): WebhookRecord {
  const db = getDatabase();
  const id = nanoid();
  const secret = generateWebhookSecret();

  const stmt = db.prepare(`
    INSERT INTO webhooks (id, facilitator_id, name, url, secret, events, action_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.facilitator_id,
    data.name,
    data.url,
    secret,
    JSON.stringify(data.events || ['payment_link.payment']),
    data.action_type || null
  );

  return getWebhookById(id)!;
}

/**
 * Get a webhook by ID
 */
export function getWebhookById(id: string): WebhookRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM webhooks WHERE id = ?');
  return (stmt.get(id) as WebhookRecord) || null;
}

/**
 * Get all webhooks for a facilitator
 */
export function getWebhooksByFacilitator(facilitatorId: string): WebhookRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM webhooks WHERE facilitator_id = ? ORDER BY created_at DESC');
  return stmt.all(facilitatorId) as WebhookRecord[];
}

/**
 * Get active webhooks for a facilitator
 */
export function getActiveWebhooks(facilitatorId: string): WebhookRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM webhooks WHERE facilitator_id = ? AND active = 1 ORDER BY created_at DESC');
  return stmt.all(facilitatorId) as WebhookRecord[];
}

/**
 * Get webhooks by event type
 */
export function getWebhooksByEvent(facilitatorId: string, eventType: string): WebhookRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM webhooks
    WHERE facilitator_id = ? AND active = 1
    AND json_each.value = ?
  `);

  // SQLite doesn't have great JSON array searching, so we'll filter in JS
  const allWebhooks = getActiveWebhooks(facilitatorId);
  return allWebhooks.filter(webhook => {
    try {
      const events = JSON.parse(webhook.events);
      return Array.isArray(events) && events.includes(eventType);
    } catch {
      return false;
    }
  });
}

/**
 * Update a webhook
 */
export function updateWebhook(
  id: string,
  updates: Partial<{
    name: string;
    url: string;
    events: string[];
    action_type: string | null;
    active: number;
  }>
): WebhookRecord | null {
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
  if (updates.events !== undefined) {
    fields.push('events = ?');
    values.push(JSON.stringify(updates.events));
  }
  if (updates.action_type !== undefined) {
    fields.push('action_type = ?');
    values.push(updates.action_type);
  }
  if (updates.active !== undefined) {
    fields.push('active = ?');
    values.push(updates.active);
  }

  if (fields.length === 0) {
    return getWebhookById(id);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getWebhookById(id);
}

/**
 * Delete a webhook
 */
export function deleteWebhook(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Regenerate webhook secret
 */
export function regenerateWebhookSecret(id: string): WebhookRecord | null {
  const db = getDatabase();
  const newSecret = generateWebhookSecret();

  const stmt = db.prepare(`
    UPDATE webhooks
    SET secret = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(newSecret, id);

  if (result.changes === 0) {
    return null;
  }

  return getWebhookById(id);
}

/**
 * Get webhook stats for a facilitator
 */
export function getWebhookStats(facilitatorId: string): {
  totalWebhooks: number;
  activeWebhooks: number;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_webhooks,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_webhooks
    FROM webhooks
    WHERE facilitator_id = ?
  `);

  const result = stmt.get(facilitatorId) as {
    total_webhooks: number;
    active_webhooks: number;
  };

  return {
    totalWebhooks: result.total_webhooks || 0,
    activeWebhooks: result.active_webhooks || 0,
  };
}
