import { Router, type Request, type Response, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getNotificationsForUser,
  getUnreadCount,
  markNotificationAsRead,
  dismissNotification,
  markAllNotificationsAsRead,
} from '../db/notifications.js';

const router: IRouter = Router();

/**
 * GET /api/notifications
 * Get notifications for authenticated user
 * Returns notifications and unread count
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const notifications = getNotificationsForUser(userId);
    const unreadCount = getUnreadCount(userId);

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read
 */
router.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const success = markNotificationAsRead(id, userId);

    if (!success) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/:id/dismiss
 * Dismiss a single notification (removes from list)
 */
router.post('/:id/dismiss', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const success = dismissNotification(id, userId);

    if (!success) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for user
 */
router.post('/mark-all-read', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const count = markAllNotificationsAsRead(userId);

    res.json({ success: true, count });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as notificationsRouter };
