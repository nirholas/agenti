"""
Stream processor for real-time analysis.
"""

import asyncio
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class StreamStatus(Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class StreamConfig:
    buffer_size: int = 10000
    batch_size: int = 100
    flush_interval_ms: int = 1000
    max_parallelism: int = 4
    enable_checkpointing: bool = True
    checkpoint_interval_ms: int = 30000


@dataclass
class StreamEvent:
    id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    event_type: str = ""
    payload: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


class StreamProcessor:
    def __init__(self, config: Optional[StreamConfig] = None):
        self.config = config or StreamConfig()
        self.status = StreamStatus.STOPPED
        self.buffer: deque[StreamEvent] = deque(maxlen=self.config.buffer_size)
        self.processors: dict[str, Callable] = {}
        self.output_handlers: list[Callable] = []
        self.metrics = {
            "events_processed": 0,
            "events_failed": 0,
            "batches_processed": 0,
        }
        self._running = False

    async def start(self) -> None:
        self._running = True
        self.status = StreamStatus.RUNNING
        asyncio.create_task(self._process_loop())

    async def stop(self) -> None:
        self._running = False
        self.status = StreamStatus.STOPPED

    def pause(self) -> None:
        self.status = StreamStatus.PAUSED

    def resume(self) -> None:
        if self._running:
            self.status = StreamStatus.RUNNING

    def register_processor(self, event_type: str, processor: Callable) -> None:
        self.processors[event_type] = processor

    def register_output(self, handler: Callable) -> None:
        self.output_handlers.append(handler)

    async def emit(self, event: StreamEvent) -> bool:
        if len(self.buffer) >= self.config.buffer_size:
            return False
        self.buffer.append(event)
        return True

    async def emit_many(self, events: list[StreamEvent]) -> int:
        added = 0
        for event in events:
            if await self.emit(event):
                added += 1
            else:
                break
        return added

    async def _process_loop(self) -> None:
        while self._running:
            if self.status != StreamStatus.RUNNING:
                await asyncio.sleep(0.1)
                continue

            batch = []
            while len(batch) < self.config.batch_size and self.buffer:
                batch.append(self.buffer.popleft())

            if batch:
                await self._process_batch(batch)
                self.metrics["batches_processed"] += 1

            await asyncio.sleep(self.config.flush_interval_ms / 1000)

    async def _process_batch(self, batch: list[StreamEvent]) -> None:
        for event in batch:
            try:
                processor = self.processors.get(event.event_type)
                if processor:
                    if asyncio.iscoroutinefunction(processor):
                        result = await processor(event)
                    else:
                        result = processor(event)

                    for handler in self.output_handlers:
                        if asyncio.iscoroutinefunction(handler):
                            await handler(result)
                        else:
                            handler(result)

                self.metrics["events_processed"] += 1
            except Exception:
                self.metrics["events_failed"] += 1

    def get_metrics(self) -> dict:
        return {
            **self.metrics,
            "buffer_size": len(self.buffer),
            "buffer_capacity": self.config.buffer_size,
            "status": self.status.value,
        }

    def clear_buffer(self) -> int:
        count = len(self.buffer)
        self.buffer.clear()
        return count
