"""
Notification Service for Lyra Intel.
"""

import asyncio
import logging
import smtplib
from dataclasses import dataclass, field
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class NotificationChannel(Enum):
    """Notification channels."""
    EMAIL = "email"
    SLACK = "slack"
    DISCORD = "discord"
    WEBHOOK = "webhook"
    SMS = "sms"
    PUSH = "push"


class NotificationPriority(Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class Notification:
    """Represents a notification."""
    title: str
    message: str
    channel: NotificationChannel
    priority: NotificationPriority = NotificationPriority.NORMAL
    recipient: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class EmailConfig:
    """Email notification configuration."""
    smtp_host: str
    smtp_port: int
    username: str
    password: str
    from_address: str
    use_tls: bool = True


@dataclass
class SlackConfig:
    """Slack notification configuration."""
    webhook_url: str
    channel: str = ""
    username: str = "Lyra Intel"
    icon_emoji: str = ":robot_face:"


@dataclass
class DiscordConfig:
    """Discord notification configuration."""
    webhook_url: str
    username: str = "Lyra Intel"
    avatar_url: str = ""


class NotificationService:
    """
    Service for sending notifications across multiple channels.
    
    Features:
    - Multi-channel support (email, Slack, Discord, webhook)
    - Priority-based handling
    - Template support
    - Rate limiting
    """
    
    def __init__(self):
        self._email_config: Optional[EmailConfig] = None
        self._slack_config: Optional[SlackConfig] = None
        self._discord_config: Optional[DiscordConfig] = None
        self._handlers: Dict[NotificationChannel, Callable] = {}
        self._queue: asyncio.Queue = asyncio.Queue()
        self._templates: Dict[str, str] = {}
        self._sent_count = 0
        
        self._setup_default_handlers()
        self._setup_default_templates()
    
    def _setup_default_handlers(self):
        """Setup default notification handlers."""
        self._handlers[NotificationChannel.EMAIL] = self._send_email
        self._handlers[NotificationChannel.SLACK] = self._send_slack
        self._handlers[NotificationChannel.DISCORD] = self._send_discord
    
    def _setup_default_templates(self):
        """Setup default notification templates."""
        self._templates = {
            "analysis_complete": """
🔍 **Analysis Complete**

Repository: {repository}
Duration: {duration}s
Files analyzed: {files_count}
Issues found: {issues_count}

{summary}
""",
            "security_alert": """
🚨 **Security Alert**

Severity: {severity}
Location: {location}
Description: {description}

Recommended action: {recommendation}
""",
            "report_ready": """
📊 **Report Ready**

Report type: {report_type}
Repository: {repository}
Generated at: {timestamp}

View report: {report_url}
""",
        }
    
    def configure_email(self, config: EmailConfig):
        """Configure email notifications."""
        self._email_config = config
        logger.info("Email notifications configured")
    
    def configure_slack(self, config: SlackConfig):
        """Configure Slack notifications."""
        self._slack_config = config
        logger.info("Slack notifications configured")
    
    def configure_discord(self, config: DiscordConfig):
        """Configure Discord notifications."""
        self._discord_config = config
        logger.info("Discord notifications configured")
    
    def add_template(self, name: str, template: str):
        """Add a notification template."""
        self._templates[name] = template
    
    def render_template(self, name: str, **kwargs) -> str:
        """Render a template with variables."""
        template = self._templates.get(name, "")
        if not template:
            return ""
        
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.warning(f"Missing template variable: {e}")
            return template
    
    async def send(
        self,
        notification: Notification,
    ) -> bool:
        """Send a notification."""
        handler = self._handlers.get(notification.channel)
        
        if not handler:
            logger.warning(f"No handler for channel {notification.channel}")
            return False
        
        try:
            await handler(notification)
            self._sent_count += 1
            logger.info(f"Notification sent via {notification.channel.value}: {notification.title}")
            return True
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return False
    
    async def broadcast(
        self,
        title: str,
        message: str,
        channels: List[NotificationChannel],
        priority: NotificationPriority = NotificationPriority.NORMAL,
        **data,
    ):
        """Broadcast a notification to multiple channels."""
        tasks = []
        
        for channel in channels:
            notification = Notification(
                title=title,
                message=message,
                channel=channel,
                priority=priority,
                data=data,
            )
            tasks.append(self.send(notification))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return sum(1 for r in results if r is True)
    
    async def _send_email(self, notification: Notification):
        """Send email notification."""
        if not self._email_config:
            raise ValueError("Email not configured")
        
        config = self._email_config
        
        msg = MIMEMultipart()
        msg["From"] = config.from_address
        msg["To"] = notification.recipient or config.from_address
        msg["Subject"] = notification.title
        
        # Add priority header
        if notification.priority == NotificationPriority.URGENT:
            msg["X-Priority"] = "1"
        elif notification.priority == NotificationPriority.HIGH:
            msg["X-Priority"] = "2"
        
        msg.attach(MIMEText(notification.message, "plain"))
        
        # Send in thread to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._smtp_send,
            config,
            msg,
        )
    
    def _smtp_send(self, config: EmailConfig, msg: MIMEMultipart):
        """Send email via SMTP (blocking)."""
        with smtplib.SMTP(config.smtp_host, config.smtp_port) as server:
            if config.use_tls:
                server.starttls()
            server.login(config.username, config.password)
            server.send_message(msg)
    
    async def _send_slack(self, notification: Notification):
        """Send Slack notification."""
        if not self._slack_config:
            raise ValueError("Slack not configured")
        
        config = self._slack_config
        
        # Build Slack message
        color = {
            NotificationPriority.LOW: "#36a64f",
            NotificationPriority.NORMAL: "#2196F3",
            NotificationPriority.HIGH: "#ff9800",
            NotificationPriority.URGENT: "#f44336",
        }.get(notification.priority, "#2196F3")
        
        payload = {
            "username": config.username,
            "icon_emoji": config.icon_emoji,
            "attachments": [{
                "title": notification.title,
                "text": notification.message,
                "color": color,
                "ts": notification.created_at.timestamp(),
            }],
        }
        
        if config.channel:
            payload["channel"] = config.channel
        
        await self._post_json(config.webhook_url, payload)
    
    async def _send_discord(self, notification: Notification):
        """Send Discord notification."""
        if not self._discord_config:
            raise ValueError("Discord not configured")
        
        config = self._discord_config
        
        # Build Discord message
        color = {
            NotificationPriority.LOW: 0x36a64f,
            NotificationPriority.NORMAL: 0x2196F3,
            NotificationPriority.HIGH: 0xff9800,
            NotificationPriority.URGENT: 0xf44336,
        }.get(notification.priority, 0x2196F3)
        
        payload = {
            "username": config.username,
            "embeds": [{
                "title": notification.title,
                "description": notification.message,
                "color": color,
                "timestamp": notification.created_at.isoformat(),
            }],
        }
        
        if config.avatar_url:
            payload["avatar_url"] = config.avatar_url
        
        await self._post_json(config.webhook_url, payload)
    
    async def _post_json(self, url: str, payload: Dict[str, Any]):
        """Post JSON payload to URL."""
        import json
        from urllib.request import Request, urlopen
        
        data = json.dumps(payload).encode()
        request = Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: urlopen(request, timeout=30),
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get notification statistics."""
        return {
            "total_sent": self._sent_count,
            "channels_configured": [
                channel.value
                for channel, handler in self._handlers.items()
                if self._is_channel_configured(channel)
            ],
            "templates_available": list(self._templates.keys()),
        }
    
    def _is_channel_configured(self, channel: NotificationChannel) -> bool:
        """Check if a channel is configured."""
        if channel == NotificationChannel.EMAIL:
            return self._email_config is not None
        elif channel == NotificationChannel.SLACK:
            return self._slack_config is not None
        elif channel == NotificationChannel.DISCORD:
            return self._discord_config is not None
        return False
