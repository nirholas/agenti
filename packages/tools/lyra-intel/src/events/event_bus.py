"""
Event Bus - Central pub/sub system for component communication.

Provides:
- Async event publishing
- Multiple subscribers per event
- Event filtering
- Event history
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Awaitable, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """An event in the system."""
    event_type: str
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "metadata": self.metadata,
        }


# Type alias for event handlers
EventHandler = Callable[[Event], Awaitable[None]]


class EventBus:
    """
    Central event bus for pub/sub communication.
    
    Features:
    - Async event publishing
    - Pattern-based subscriptions
    - Event history
    - Dead letter queue for failed handlers
    """
    
    def __init__(self, max_history: int = 1000):
        self._subscribers: Dict[str, List[EventHandler]] = {}
        self._wildcard_subscribers: List[tuple] = []  # (pattern, handler)
        self._history: List[Event] = []
        self._max_history = max_history
        self._dead_letter_queue: List[tuple] = []  # (event, error, handler)
        self._running = False
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._stats = {
            "events_published": 0,
            "events_delivered": 0,
            "events_failed": 0,
        }
    
    def subscribe(self, event_type: str, handler: EventHandler) -> str:
        """
        Subscribe to an event type.
        
        Args:
            event_type: Event type to subscribe to (supports * wildcard)
            handler: Async function to handle events
            
        Returns:
            Subscription ID for unsubscribing
        """
        subscription_id = str(uuid.uuid4())
        
        if "*" in event_type:
            # Wildcard subscription
            pattern = event_type.replace("*", ".*")
            self._wildcard_subscribers.append((pattern, handler, subscription_id))
            logger.debug(f"Wildcard subscription added: {event_type}")
        else:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            self._subscribers[event_type].append((handler, subscription_id))
            logger.debug(f"Subscription added: {event_type}")
        
        return subscription_id
    
    def unsubscribe(self, subscription_id: str) -> bool:
        """Unsubscribe using subscription ID."""
        # Check regular subscribers
        for event_type, handlers in self._subscribers.items():
            for i, (handler, sub_id) in enumerate(handlers):
                if sub_id == subscription_id:
                    handlers.pop(i)
                    return True
        
        # Check wildcard subscribers
        for i, (pattern, handler, sub_id) in enumerate(self._wildcard_subscribers):
            if sub_id == subscription_id:
                self._wildcard_subscribers.pop(i)
                return True
        
        return False
    
    async def publish(self, event: Event) -> int:
        """
        Publish an event to all subscribers.
        
        Args:
            event: Event to publish
            
        Returns:
            Number of handlers that received the event
        """
        self._stats["events_published"] += 1
        
        # Add to history
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history.pop(0)
        
        handlers_called = 0
        
        # Direct subscribers
        if event.event_type in self._subscribers:
            for handler, _ in self._subscribers[event.event_type]:
                try:
                    await handler(event)
                    handlers_called += 1
                    self._stats["events_delivered"] += 1
                except Exception as e:
                    self._stats["events_failed"] += 1
                    self._dead_letter_queue.append((event, str(e), handler))
                    logger.error(f"Event handler failed: {e}")
        
        # Wildcard subscribers
        import re
        for pattern, handler, _ in self._wildcard_subscribers:
            if re.match(pattern, event.event_type):
                try:
                    await handler(event)
                    handlers_called += 1
                    self._stats["events_delivered"] += 1
                except Exception as e:
                    self._stats["events_failed"] += 1
                    self._dead_letter_queue.append((event, str(e), handler))
                    logger.error(f"Wildcard event handler failed: {e}")
        
        return handlers_called
    
    async def publish_many(self, events: List[Event]) -> int:
        """Publish multiple events."""
        total = 0
        for event in events:
            total += await self.publish(event)
        return total
    
    def emit(self, event_type: str, data: Dict[str, Any], source: str = "") -> None:
        """
        Convenience method to create and queue an event.
        
        Args:
            event_type: Type of event
            data: Event data
            source: Source component
        """
        event = Event(
            event_type=event_type,
            data=data,
            source=source,
        )
        self._event_queue.put_nowait(event)
    
    async def start_processing(self):
        """Start processing queued events."""
        self._running = True
        while self._running:
            try:
                event = await asyncio.wait_for(
                    self._event_queue.get(),
                    timeout=0.1
                )
                await self.publish(event)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing event: {e}")
    
    def stop_processing(self):
        """Stop processing events."""
        self._running = False
    
    def get_history(
        self,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Event]:
        """Get event history, optionally filtered by type."""
        if event_type:
            filtered = [e for e in self._history if e.event_type == event_type]
            return filtered[-limit:]
        return self._history[-limit:]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get event bus statistics."""
        return {
            **self._stats,
            "subscribers": len(self._subscribers),
            "wildcard_subscribers": len(self._wildcard_subscribers),
            "history_size": len(self._history),
            "dead_letter_queue_size": len(self._dead_letter_queue),
        }
    
    def clear_dead_letter_queue(self) -> List[tuple]:
        """Clear and return dead letter queue."""
        dlq = self._dead_letter_queue.copy()
        self._dead_letter_queue.clear()
        return dlq


# Global event bus instance
_global_event_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    global _global_event_bus
    if _global_event_bus is None:
        _global_event_bus = EventBus()
    return _global_event_bus
