"""
Job scheduler for recurring analysis tasks.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class JobStatus(Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobPriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class JobConfig:
    max_retries: int = 3
    retry_delay_seconds: int = 60
    timeout_seconds: int = 3600
    max_concurrent_jobs: int = 10
    enable_persistence: bool = False


@dataclass
class ScheduledJob:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    handler: Optional[Callable] = None
    schedule: str = ""  # cron expression
    priority: JobPriority = JobPriority.NORMAL
    status: JobStatus = JobStatus.PENDING
    payload: dict = field(default_factory=dict)
    next_run: Optional[datetime] = None
    last_run: Optional[datetime] = None
    last_result: Optional[Any] = None
    last_error: Optional[str] = None
    run_count: int = 0
    fail_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    enabled: bool = True
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "schedule": self.schedule,
            "status": self.status.value,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "run_count": self.run_count,
            "enabled": self.enabled,
        }


class JobScheduler:
    def __init__(self, config: Optional[JobConfig] = None):
        self.config = config or JobConfig()
        self.jobs: dict[str, ScheduledJob] = {}
        self.handlers: dict[str, Callable] = {}
        self._running = False
        self._current_jobs: set[str] = set()

    async def start(self) -> None:
        self._running = True
        asyncio.create_task(self._scheduler_loop())

    async def stop(self) -> None:
        self._running = False

    def register_handler(self, name: str, handler: Callable) -> None:
        self.handlers[name] = handler

    def schedule(
        self,
        name: str,
        handler_name: str,
        schedule: str,
        payload: Optional[dict] = None,
        priority: JobPriority = JobPriority.NORMAL,
        tags: Optional[list[str]] = None,
    ) -> ScheduledJob:
        handler = self.handlers.get(handler_name)
        if not handler:
            raise ValueError(f"Unknown handler: {handler_name}")

        job = ScheduledJob(
            name=name,
            handler=handler,
            schedule=schedule,
            payload=payload or {},
            priority=priority,
            status=JobStatus.SCHEDULED,
            tags=tags or [],
        )

        job.next_run = self._calculate_next_run(schedule)
        self.jobs[job.id] = job
        return job

    def schedule_once(
        self,
        name: str,
        handler_name: str,
        run_at: datetime,
        payload: Optional[dict] = None,
    ) -> ScheduledJob:
        handler = self.handlers.get(handler_name)
        if not handler:
            raise ValueError(f"Unknown handler: {handler_name}")

        job = ScheduledJob(
            name=name,
            handler=handler,
            payload=payload or {},
            status=JobStatus.SCHEDULED,
            next_run=run_at,
        )
        self.jobs[job.id] = job
        return job

    def cancel(self, job_id: str) -> bool:
        job = self.jobs.get(job_id)
        if not job:
            return False
        job.status = JobStatus.CANCELLED
        job.enabled = False
        return True

    def enable(self, job_id: str) -> bool:
        job = self.jobs.get(job_id)
        if not job:
            return False
        job.enabled = True
        if job.schedule:
            job.next_run = self._calculate_next_run(job.schedule)
        job.status = JobStatus.SCHEDULED
        return True

    def disable(self, job_id: str) -> bool:
        job = self.jobs.get(job_id)
        if not job:
            return False
        job.enabled = False
        return True

    async def _scheduler_loop(self) -> None:
        while self._running:
            now = datetime.utcnow()

            for job in list(self.jobs.values()):
                if not job.enabled or job.status == JobStatus.RUNNING:
                    continue
                if job.next_run and job.next_run <= now:
                    if len(self._current_jobs) < self.config.max_concurrent_jobs:
                        asyncio.create_task(self._run_job(job))

            await asyncio.sleep(1)

    async def _run_job(self, job: ScheduledJob) -> None:
        job.status = JobStatus.RUNNING
        job.last_run = datetime.utcnow()
        self._current_jobs.add(job.id)

        try:
            if job.handler:
                if asyncio.iscoroutinefunction(job.handler):
                    result = await asyncio.wait_for(
                        job.handler(job.payload),
                        timeout=self.config.timeout_seconds,
                    )
                else:
                    result = job.handler(job.payload)

                job.last_result = result
                job.status = JobStatus.COMPLETED
                job.run_count += 1

        except asyncio.TimeoutError:
            job.last_error = "Job timed out"
            job.status = JobStatus.FAILED
            job.fail_count += 1
        except Exception as e:
            job.last_error = str(e)
            job.status = JobStatus.FAILED
            job.fail_count += 1
        finally:
            self._current_jobs.discard(job.id)

            # Reschedule if recurring
            if job.schedule:
                job.next_run = self._calculate_next_run(job.schedule)
                job.status = JobStatus.SCHEDULED

    def _calculate_next_run(self, schedule: str) -> datetime:
        # Simplified: parse basic interval notation
        now = datetime.utcnow()

        if schedule.startswith("@every"):
            parts = schedule.split()
            if len(parts) >= 2:
                interval = parts[1]
                if interval.endswith("s"):
                    return now + timedelta(seconds=int(interval[:-1]))
                elif interval.endswith("m"):
                    return now + timedelta(minutes=int(interval[:-1]))
                elif interval.endswith("h"):
                    return now + timedelta(hours=int(interval[:-1]))
                elif interval.endswith("d"):
                    return now + timedelta(days=int(interval[:-1]))

        # Default to 1 hour
        return now + timedelta(hours=1)

    def get_job(self, job_id: str) -> Optional[ScheduledJob]:
        return self.jobs.get(job_id)

    def list_jobs(
        self,
        status: Optional[JobStatus] = None,
        tag: Optional[str] = None,
    ) -> list[ScheduledJob]:
        results = []
        for job in self.jobs.values():
            if status and job.status != status:
                continue
            if tag and tag not in job.tags:
                continue
            results.append(job)
        return results

    def get_stats(self) -> dict:
        by_status = {}
        for job in self.jobs.values():
            by_status[job.status.value] = by_status.get(job.status.value, 0) + 1

        return {
            "total_jobs": len(self.jobs),
            "running_jobs": len(self._current_jobs),
            "by_status": by_status,
            "total_runs": sum(j.run_count for j in self.jobs.values()),
            "total_failures": sum(j.fail_count for j in self.jobs.values()),
        }
