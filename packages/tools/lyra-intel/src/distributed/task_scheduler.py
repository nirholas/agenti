"""
Distributed task scheduling for parallel analysis.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class TaskStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class TaskPriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class DistributedTask:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    task_type: str = ""
    priority: TaskPriority = TaskPriority.NORMAL
    status: TaskStatus = TaskStatus.PENDING
    payload: dict = field(default_factory=dict)
    result: Optional[Any] = None
    error: Optional[str] = None
    assigned_node: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    timeout_seconds: int = 3600
    dependencies: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.task_type,
            "priority": self.priority.name,
            "status": self.status.value,
            "assigned_node": self.assigned_node,
            "retry_count": self.retry_count,
        }

    def duration_seconds(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class DistributedTaskScheduler:
    def __init__(self, cluster_manager=None):
        self.cluster_manager = cluster_manager
        self.tasks: dict[str, DistributedTask] = {}
        self.task_queue: list[str] = []
        self.task_handlers: dict[str, Callable] = {}
        self._running = False

    async def start(self) -> None:
        self._running = True
        asyncio.create_task(self._process_queue())

    async def stop(self) -> None:
        self._running = False

    def register_handler(self, task_type: str, handler: Callable) -> None:
        self.task_handlers[task_type] = handler

    def submit_task(
        self,
        name: str,
        task_type: str,
        payload: dict,
        priority: TaskPriority = TaskPriority.NORMAL,
        dependencies: Optional[list[str]] = None,
        timeout_seconds: int = 3600,
    ) -> DistributedTask:
        task = DistributedTask(
            name=name,
            task_type=task_type,
            payload=payload,
            priority=priority,
            dependencies=dependencies or [],
            timeout_seconds=timeout_seconds,
        )
        self.tasks[task.id] = task
        self._enqueue_task(task)
        return task

    def _enqueue_task(self, task: DistributedTask) -> None:
        task.status = TaskStatus.QUEUED
        # Insert based on priority
        inserted = False
        for i, tid in enumerate(self.task_queue):
            existing = self.tasks.get(tid)
            if existing and task.priority.value > existing.priority.value:
                self.task_queue.insert(i, task.id)
                inserted = True
                break
        if not inserted:
            self.task_queue.append(task.id)

    async def _process_queue(self) -> None:
        while self._running:
            if not self.task_queue:
                await asyncio.sleep(0.1)
                continue

            task_id = self.task_queue[0]
            task = self.tasks.get(task_id)
            if not task:
                self.task_queue.pop(0)
                continue

            # Check dependencies
            if not self._dependencies_satisfied(task):
                await asyncio.sleep(0.1)
                continue

            # Get available node
            node = None
            if self.cluster_manager:
                node = self.cluster_manager.get_best_node()

            self.task_queue.pop(0)
            asyncio.create_task(self._execute_task(task, node))

    def _dependencies_satisfied(self, task: DistributedTask) -> bool:
        for dep_id in task.dependencies:
            dep = self.tasks.get(dep_id)
            if not dep or dep.status != TaskStatus.COMPLETED:
                return False
        return True

    async def _execute_task(self, task: DistributedTask, node=None) -> None:
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        task.assigned_node = node.id if node else "local"

        handler = self.task_handlers.get(task.task_type)
        if not handler:
            task.status = TaskStatus.FAILED
            task.error = f"No handler for task type: {task.task_type}"
            return

        try:
            result = await asyncio.wait_for(
                self._run_handler(handler, task),
                timeout=task.timeout_seconds,
            )
            task.result = result
            task.status = TaskStatus.COMPLETED
        except asyncio.TimeoutError:
            task.error = "Task timed out"
            await self._handle_failure(task)
        except Exception as e:
            task.error = str(e)
            await self._handle_failure(task)
        finally:
            task.completed_at = datetime.utcnow()

    async def _run_handler(self, handler: Callable, task: DistributedTask) -> Any:
        if asyncio.iscoroutinefunction(handler):
            return await handler(task.payload)
        return handler(task.payload)

    async def _handle_failure(self, task: DistributedTask) -> None:
        if task.retry_count < task.max_retries:
            task.retry_count += 1
            task.status = TaskStatus.RETRYING
            self._enqueue_task(task)
        else:
            task.status = TaskStatus.FAILED

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if not task:
            return False
        if task.status in [TaskStatus.PENDING, TaskStatus.QUEUED]:
            task.status = TaskStatus.CANCELLED
            if task_id in self.task_queue:
                self.task_queue.remove(task_id)
            return True
        return False

    def get_task(self, task_id: str) -> Optional[DistributedTask]:
        return self.tasks.get(task_id)

    def get_queue_stats(self) -> dict:
        by_status = {}
        by_priority = {}
        total_duration = 0
        completed_count = 0

        for task in self.tasks.values():
            status = task.status.value
            by_status[status] = by_status.get(status, 0) + 1

            priority = task.priority.name
            by_priority[priority] = by_priority.get(priority, 0) + 1

            duration = task.duration_seconds()
            if duration:
                total_duration += duration
                completed_count += 1

        return {
            "total_tasks": len(self.tasks),
            "queue_length": len(self.task_queue),
            "by_status": by_status,
            "by_priority": by_priority,
            "avg_duration": total_duration / completed_count if completed_count else 0,
        }

    def get_pending_tasks(self) -> list[DistributedTask]:
        return [t for t in self.tasks.values() if t.status in [TaskStatus.PENDING, TaskStatus.QUEUED]]

    def get_running_tasks(self) -> list[DistributedTask]:
        return [t for t in self.tasks.values() if t.status == TaskStatus.RUNNING]

    def get_failed_tasks(self) -> list[DistributedTask]:
        return [t for t in self.tasks.values() if t.status == TaskStatus.FAILED]

    def clear_completed(self) -> int:
        to_remove = [tid for tid, t in self.tasks.items() if t.status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]]
        for tid in to_remove:
            del self.tasks[tid]
        return len(to_remove)
