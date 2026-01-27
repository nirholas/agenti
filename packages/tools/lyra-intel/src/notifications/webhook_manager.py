"""
Webhook Manager for Lyra Intel.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError

logger = logging.getLogger(__name__)


class WebhookEvent(Enum):
    """Webhook event types."""
    # Analysis events
    ANALYSIS_STARTED = "analysis.started"
    ANALYSIS_COMPLETED = "analysis.completed"
    ANALYSIS_FAILED = "analysis.failed"
    
    # Report events
    REPORT_GENERATED = "report.generated"
    REPORT_FAILED = "report.failed"
    
    # Pattern events
    PATTERN_DETECTED = "pattern.detected"
    SECURITY_ISSUE_FOUND = "security.issue_found"
    
    # System events
    SYSTEM_HEALTH = "system.health"
    SYSTEM_ERROR = "system.error"
    
    # Agent events
    AGENT_STARTED = "agent.started"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"


@dataclass
class WebhookConfig:
    """Webhook configuration."""
    url: str
    events: List[WebhookEvent]
    secret: str = ""
    enabled: bool = True
    retry_count: int = 3
    retry_delay_seconds: int = 10
    timeout_seconds: int = 30


@dataclass
class WebhookDelivery:
    """Record of a webhook delivery attempt."""
    webhook_id: str
    event: WebhookEvent
    payload: Dict[str, Any]
    response_code: int
    response_body: str
    delivered_at: datetime
    success: bool
    duration_ms: int


class WebhookManager:
    """
    Manages webhook subscriptions and deliveries.
    
    Features:
    - Event subscription management
    - Secure payload signing
    - Retry with exponential backoff
    - Delivery logging
    """
    
    def __init__(self):
        self._webhooks: Dict[str, WebhookConfig] = {}
        self._delivery_log: List[WebhookDelivery] = []
        self._event_filters: Dict[str, Callable] = {}
    
    def register_webhook(
        self,
        webhook_id: str,
        config: WebhookConfig,
    ):
        """Register a webhook."""
        self._webhooks[webhook_id] = config
        logger.info(f"Registered webhook {webhook_id} for events: {[e.value for e in config.events]}")
    
    def unregister_webhook(self, webhook_id: str):
        """Unregister a webhook."""
        if webhook_id in self._webhooks:
            del self._webhooks[webhook_id]
            logger.info(f"Unregistered webhook {webhook_id}")
    
    def add_event_filter(self, event: WebhookEvent, filter_fn: Callable):
        """Add a filter function for an event type."""
        self._event_filters[event.value] = filter_fn
    
    async def trigger(
        self,
        event: WebhookEvent,
        payload: Dict[str, Any],
    ):
        """Trigger webhooks for an event."""
        # Add event metadata
        full_payload = {
            "event": event.value,
            "timestamp": datetime.utcnow().isoformat(),
            "data": payload,
        }
        
        # Apply event filter if exists
        if event.value in self._event_filters:
            filter_fn = self._event_filters[event.value]
            if not filter_fn(payload):
                logger.debug(f"Event {event.value} filtered out")
                return
        
        # Find subscribed webhooks
        subscribed = [
            (wid, config)
            for wid, config in self._webhooks.items()
            if event in config.events and config.enabled
        ]
        
        if not subscribed:
            logger.debug(f"No webhooks subscribed to {event.value}")
            return
        
        # Deliver to all subscribed webhooks
        tasks = [
            self._deliver(webhook_id, config, full_payload)
            for webhook_id, config in subscribed
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _deliver(
        self,
        webhook_id: str,
        config: WebhookConfig,
        payload: Dict[str, Any],
    ):
        """Deliver payload to a webhook."""
        payload_bytes = json.dumps(payload).encode()
        
        # Sign payload
        signature = self._sign_payload(payload_bytes, config.secret)
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "X-Lyra-Event": payload.get("event", "unknown"),
            "X-Lyra-Timestamp": payload.get("timestamp", ""),
            "X-Lyra-Signature": signature,
            "User-Agent": "LyraIntel-Webhook/1.0",
        }
        
        # Attempt delivery with retries
        for attempt in range(config.retry_count):
            start_time = time.time()
            
            try:
                request = Request(
                    config.url,
                    data=payload_bytes,
                    headers=headers,
                    method="POST",
                )
                
                with urlopen(request, timeout=config.timeout_seconds) as response:
                    response_code = response.getcode()
                    response_body = response.read().decode()[:1000]
                    duration_ms = int((time.time() - start_time) * 1000)
                    
                    success = 200 <= response_code < 300
                    
                    # Safely convert event string to enum
                    event_str = payload.get("event", "")
                    try:
                        event_enum = WebhookEvent(event_str)
                    except ValueError:
                        event_enum = WebhookEvent.SYSTEM_ERROR
                    
                    delivery = WebhookDelivery(
                        webhook_id=webhook_id,
                        event=event_enum,
                        payload=payload,
                        response_code=response_code,
                        response_body=response_body,
                        delivered_at=datetime.utcnow(),
                        success=success,
                        duration_ms=duration_ms,
                    )
                    self._delivery_log.append(delivery)
                    
                    if success:
                        logger.info(f"Webhook {webhook_id} delivered successfully")
                        return
                    else:
                        logger.warning(f"Webhook {webhook_id} returned {response_code}")
                        
            except URLError as e:
                duration_ms = int((time.time() - start_time) * 1000)
                
                delivery = WebhookDelivery(
                    webhook_id=webhook_id,
                    event=WebhookEvent(payload.get("event", "")),
                    payload=payload,
                    response_code=0,
                    response_body=str(e),
                    delivered_at=datetime.utcnow(),
                    success=False,
                    duration_ms=duration_ms,
                )
                self._delivery_log.append(delivery)
                
                logger.warning(f"Webhook {webhook_id} failed (attempt {attempt + 1}): {e}")
            
            # Wait before retry
            if attempt < config.retry_count - 1:
                delay = config.retry_delay_seconds * (2 ** attempt)
                await asyncio.sleep(delay)
        
        logger.error(f"Webhook {webhook_id} failed after {config.retry_count} attempts")
    
    def _sign_payload(self, payload: bytes, secret: str) -> str:
        """Sign a payload with HMAC-SHA256."""
        if not secret:
            return ""
        
        return hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
    
    def verify_signature(
        self,
        payload: bytes,
        signature: str,
        secret: str,
    ) -> bool:
        """Verify a webhook signature."""
        expected = self._sign_payload(payload, secret)
        return hmac.compare_digest(signature, expected)
    
    def get_delivery_log(
        self,
        webhook_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[WebhookDelivery]:
        """Get delivery log, optionally filtered by webhook ID."""
        log = self._delivery_log
        
        if webhook_id:
            log = [d for d in log if d.webhook_id == webhook_id]
        
        return log[-limit:]
    
    def get_webhook_stats(self, webhook_id: str) -> Dict[str, Any]:
        """Get statistics for a webhook."""
        deliveries = [d for d in self._delivery_log if d.webhook_id == webhook_id]
        
        if not deliveries:
            return {
                "total_deliveries": 0,
                "success_rate": 0.0,
                "average_duration_ms": 0,
            }
        
        successful = sum(1 for d in deliveries if d.success)
        
        return {
            "total_deliveries": len(deliveries),
            "successful": successful,
            "failed": len(deliveries) - successful,
            "success_rate": successful / len(deliveries) * 100,
            "average_duration_ms": sum(d.duration_ms for d in deliveries) / len(deliveries),
        }
    
    def list_webhooks(self) -> List[Dict[str, Any]]:
        """List all registered webhooks."""
        return [
            {
                "id": wid,
                "url": config.url,
                "events": [e.value for e in config.events],
                "enabled": config.enabled,
            }
            for wid, config in self._webhooks.items()
        ]
