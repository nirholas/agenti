"""
Job queue for distributed job execution.
"""

import asyncio
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class QueueStatus(Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"


@dataclass
class QueueConfig:
    max_size: int = 10000
    max_workers: int = 4
    retry_limit: int = 3
    retry_delay_seconds: int = 60
    dead_letter_queue: bool = True


@dataclass
class QueueJob:
    id: str = field(default_factory=lambda: str(uuid4()))
    job_type: str = ""
    payload: dict = field(default_factory=dict)
    priority: int = 0
    attempts: int = 0
    max_attempts: int = 3
    created_at: datetime = field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


class JobQueue:
    def __init__(self, config: Optional[QueueConfig] = None):
        self.config = config or QueueConfig()
        self.queue: deque[QueueJob] = deque(maxlen=self.config.max_size)
        self.dead_letter_queue: list[QueueJob] = []
        self.handlers: dict[str, Callable] = {}
        self.status = QueueStatus.STOPPED
        self._workers: list[asyncio.Task] = []
        self.metrics = {
            "enqueued": 0,
            "processed": 0,
            "failed": 0,
            "dead_lettered": 0,
        }

    async def start(self) -> None:
        self.status = QueueStatus.RUNNING
        for i in range(self.config.max_workers):
            worker = asyncio.create_task(self._worker(i))
            self._workers.append(worker)

    async def stop(self) -> None:
        self.status = QueueStatus.STOPPED
        for worker in self._workers:
            worker.cancel()
        self._workers = []

    def pause(self) -> None:
        self.status = QueueStatus.PAUSED

    def resume(self) -> None:
        self.status = QueueStatus.RUNNING

    def register_handler(self, job_type: str, handler: Callable) -> None:
        self.handlers[job_type] = handler

    def enqueue(
        self,
        job_type: str,
        payload: dict,
        priority: int = 0,
    ) -> QueueJob:
        job = QueueJob(
            job_type=job_type,
            payload=payload,
            priority=priority,
            max_attempts=self.config.retry_limit,
        )
        self.queue.append(job)
        self.metrics["enqueued"] += 1
        return job

    def enqueue_many(self, jobs: list[tuple[str, dict]]) -> list[QueueJob]:
        created = []
        for job_type, payload in jobs:
            job = self.enqueue(job_type, payload)
            created.append(job)
        return created

    async def _worker(self, worker_id: int) -> None:
        while self.status != QueueStatus.STOPPED:
            if self.status == QueueStatus.PAUSED:
                await asyncio.sleep(0.1)
                continue

            if not self.queue:
                await asyncio.sleep(0.01)
                continue

            job = self.queue.popleft()
            await self._process_job(job)

    async def _process_job(self, job: QueueJob) -> None:
        job.processed_at = datetime.utcnow()
        job.attempts += 1

        handler = self.handlers.get(job.job_type)
        if not handler:
            job.error = f"No handler for job type: {job.job_type}"
            self._handle_failure(job)
            return

        try:
            if asyncio.iscoroutinefunction(handler):
                await handler(job.payload)
            else:
                handler(job.payload)

            job.completed_at = datetime.utcnow()
            self.metrics["processed"] += 1

        except Exception as e:
            job.error = str(e)
            self._handle_failure(job)

    def _handle_failure(self, job: QueueJob) -> None:
        self.metrics["failed"] += 1

        if job.attempts < job.max_attempts:
            # Requeue for retry
            self.queue.append(job)
        elif self.config.dead_letter_queue:
            self.dead_letter_queue.append(job)
            self.metrics["dead_lettered"] += 1

    def get_queue_length(self) -> int:
        return len(self.queue)

    def get_dead_letter_count(self) -> int:
        return len(self.dead_letter_queue)

    def retry_dead_letters(self) -> int:
        count = 0
        for job in self.dead_letter_queue:
            job.attempts = 0
            job.error = None
            self.queue.append(job)
            count += 1
        self.dead_letter_queue.clear()
        return count

    def clear(self) -> int:
        count = len(self.queue)
        self.queue.clear()
        return count

    def get_stats(self) -> dict:
        return {
            **self.metrics,
            "queue_length": len(self.queue),
            "dead_letter_count": len(self.dead_letter_queue),
            "status": self.status.value,
            "workers": len(self._workers),
        }
