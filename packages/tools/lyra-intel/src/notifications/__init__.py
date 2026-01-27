"""
Notifications and Webhooks Module.

Provides:
- Webhook integration for analysis events
- Email notifications
- Slack/Discord integrations
- Alert management
"""

from .webhook_manager import WebhookManager, WebhookConfig
from .notification_service import NotificationService
from .alert_manager import AlertManager, Alert, AlertSeverity

__all__ = [
    "WebhookManager",
    "WebhookConfig",
    "NotificationService",
    "AlertManager",
    "Alert",
    "AlertSeverity",
]
