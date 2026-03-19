import { randomUUID } from 'crypto';
import { getDatabase } from './index.js';

// Notification types
export type NotificationType =
  | 'payment_success'
  | 'payment_failed'
  | 'low_balance'
  | 'expiration_reminder'
  | 'subscription_restored'
  | 'subscription_expired';

// Notification severity levels
export type NotificationSeverity = 'success' | 'warning' | 'error' | 'info';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  dismissed: boolean;
  metadata: string; // JSON stringified object
  created_at: string;
}

// Internal type for SQLite rows (read/dismissed stored as INTEGER)
interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: number;
  dismissed: number;
  metadata: string;
  created_at: string;
}

/**
 * Convert a database row to a Notification object
 */
function rowToNotification(row: NotificationRow): Notification {
  return {
    ...row,
    read: Boolean(row.read),
    dismissed: Boolean(row.dismissed),
  };
}

/**
 * Create a new notification
 */
export function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  severity: NotificationSeverity,
  metadata: Record<string, unknown> = {}
): Notification {
  const db = getDatabase();
  const id = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, severity, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, type, title, message, severity, JSON.stringify(metadata));

  return getNotificationById(id)!;
}

/**
 * Get a notification by ID
 */
export function getNotificationById(id: string): Notification | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notifications WHERE id = ?');
  const row = stmt.get(id) as NotificationRow | undefined;

  if (!row) return null;
  return rowToNotification(row);
}

/**
 * Get notifications for a user
 * @param userId - User ID
 * @param limit - Max number of notifications to return (default 50)
 * @param includeDismissed - Whether to include dismissed notifications (default false)
 */
export function getNotificationsForUser(
  userId: string,
  limit: number = 50,
  includeDismissed: boolean = false
): Notification[] {
  const db = getDatabase();

  const query = includeDismissed
    ? `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM notifications WHERE user_id = ? AND dismissed = 0 ORDER BY created_at DESC LIMIT ?`;

  const stmt = db.prepare(query);
  const rows = stmt.all(userId, limit) as NotificationRow[];

  return rows.map(rowToNotification);
}

/**
 * Get count of unread, undismissed notifications for a user
 */
export function getUnreadCount(userId: string): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ? AND read = 0 AND dismissed = 0
  `);
  const result = stmt.get(userId) as { count: number };
  return result.count;
}

/**
 * Mark a notification as read (verifies ownership)
 */
export function markNotificationAsRead(id: string, userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE notifications SET read = 1
    WHERE id = ? AND user_id = ?
  `);
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Mark a notification as dismissed (verifies ownership)
 */
export function dismissNotification(id: string, userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE notifications SET dismissed = 1
    WHERE id = ? AND user_id = ?
  `);
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Mark all notifications as read for a user
 */
export function markAllNotificationsAsRead(userId: string): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE notifications SET read = 1
    WHERE user_id = ? AND read = 0
  `);
  const result = stmt.run(userId);
  return result.changes;
}

/**
 * Check if user has a recent notification of a specific type
 * Used to prevent duplicate notifications
 * @param userId - User ID
 * @param type - Notification type
 * @param hoursAgo - Hours to look back (e.g., 24 for low_balance, 72 for expiration_reminder)
 */
export function hasRecentNotificationOfType(
  userId: string,
  type: NotificationType,
  hoursAgo: number
): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ? AND type = ?
      AND created_at >= datetime('now', '-' || ? || ' hours')
  `);
  const result = stmt.get(userId, type, hoursAgo) as { count: number };
  return result.count > 0;
}
