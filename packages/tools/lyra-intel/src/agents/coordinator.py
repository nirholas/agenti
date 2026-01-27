"""
Agent Coordinator - Orchestrates the multi-agent analysis fleet.

Manages:
- Agent lifecycle
- Task distribution
- Result aggregation
- Load balancing
- Fault tolerance
"""

import asyncio
import uuid
from typing import Dict, List, Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


class AgentStatus(Enum):
    """Agent status states."""
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"


class TaskStatus(Enum):
    """Task status states."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class TaskPriority(Enum):
    """Task priority levels."""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class Task:
    """Analysis task definition."""
    id: str
    task_type: str
    payload: Dict[str, Any]
    priority: TaskPriority = TaskPriority.NORMAL
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_agent: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "task_type": self.task_type,
            "payload": self.payload,
            "priority": self.priority.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "assigned_agent": self.assigned_agent,
            "result": self.result,
            "error": self.error,
            "retries": self.retries,
        }


@dataclass
class Agent:
    """Analysis agent instance."""
    id: str
    agent_type: str
    status: AgentStatus = AgentStatus.IDLE
    current_task: Optional[str] = None
    tasks_completed: int = 0
    tasks_failed: int = 0
    last_heartbeat: datetime = field(default_factory=datetime.now)
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "agent_type": self.agent_type,
            "status": self.status.value,
            "current_task": self.current_task,
            "tasks_completed": self.tasks_completed,
            "tasks_failed": self.tasks_failed,
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "capabilities": self.capabilities,
        }


@dataclass
class CoordinatorConfig:
    """Configuration for agent coordinator."""
    max_agents: int = 100
    max_queue_size: int = 10000
    task_timeout_seconds: int = 3600  # 1 hour
    heartbeat_interval_seconds: int = 30
    retry_delay_seconds: int = 60
    enable_auto_scaling: bool = True
    min_agents: int = 1
    scale_up_threshold: float = 0.8  # Queue utilization
    scale_down_threshold: float = 0.2


class AgentCoordinator:
    """
    Coordinates the multi-agent analysis fleet.
    
    Features:
    - Dynamic agent pool management
    - Priority-based task queue
    - Load balancing across agents
    - Automatic failover and retry
    - Real-time monitoring
    - Auto-scaling based on load
    """
    
    def __init__(self, config: Optional[CoordinatorConfig] = None):
        self.config = config or CoordinatorConfig()
        
        self._agents: Dict[str, Agent] = {}
        self._task_queue: asyncio.PriorityQueue = asyncio.PriorityQueue(
            maxsize=self.config.max_queue_size
        )
        self._tasks: Dict[str, Task] = {}
        self._task_handlers: Dict[str, Callable[[Dict], Awaitable[Dict]]] = {}
        
        self._running = False
        self._dispatcher_task = None
        self._monitor_task = None
        
    async def start(self) -> None:
        """Start the coordinator."""
        logger.info("Starting agent coordinator...")
        self._running = True
        
        # Start background tasks
        self._dispatcher_task = asyncio.create_task(self._dispatch_loop())
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        
        logger.info("Agent coordinator started")
        
    async def stop(self) -> None:
        """Stop the coordinator."""
        logger.info("Stopping agent coordinator...")
        self._running = False
        
        if self._dispatcher_task:
            self._dispatcher_task.cancel()
        if self._monitor_task:
            self._monitor_task.cancel()
            
        logger.info("Agent coordinator stopped")
        
    def register_handler(
        self,
        task_type: str,
        handler: Callable[[Dict], Awaitable[Dict]]
    ) -> None:
        """Register a handler for a task type."""
        self._task_handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")
        
    async def register_agent(
        self,
        agent_type: str,
        capabilities: List[str] = None
    ) -> str:
        """Register a new agent and return its ID."""
        if len(self._agents) >= self.config.max_agents:
            raise RuntimeError("Maximum agent limit reached")
            
        agent_id = str(uuid.uuid4())[:8]
        
        agent = Agent(
            id=agent_id,
            agent_type=agent_type,
            capabilities=capabilities or [],
        )
        
        self._agents[agent_id] = agent
        logger.info(f"Registered agent: {agent_id} (type: {agent_type})")
        
        return agent_id
        
    async def unregister_agent(self, agent_id: str) -> None:
        """Unregister an agent."""
        if agent_id in self._agents:
            agent = self._agents[agent_id]
            
            # Re-queue current task if any
            if agent.current_task:
                task = self._tasks.get(agent.current_task)
                if task and task.status == TaskStatus.RUNNING:
                    task.status = TaskStatus.PENDING
                    task.assigned_agent = None
                    await self._enqueue_task(task)
            
            del self._agents[agent_id]
            logger.info(f"Unregistered agent: {agent_id}")
            
    async def submit_task(
        self,
        task_type: str,
        payload: Dict[str, Any],
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> str:
        """Submit a task to the queue."""
        task_id = str(uuid.uuid4())[:12]
        
        task = Task(
            id=task_id,
            task_type=task_type,
            payload=payload,
            priority=priority,
        )
        
        self._tasks[task_id] = task
        await self._enqueue_task(task)
        
        logger.debug(f"Task submitted: {task_id} (type: {task_type})")
        return task_id
        
    async def _enqueue_task(self, task: Task) -> None:
        """Add task to priority queue."""
        # Priority queue sorts by first element (lower = higher priority)
        # Negate priority so higher priority comes first
        priority_value = -task.priority.value
        await self._task_queue.put((priority_value, task.created_at, task.id))
        
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a task."""
        task = self._tasks.get(task_id)
        return task.to_dict() if task else None
        
    async def wait_for_task(self, task_id: str, timeout: float = None) -> Dict[str, Any]:
        """Wait for a task to complete."""
        start_time = datetime.now()
        
        while True:
            task = self._tasks.get(task_id)
            
            if not task:
                raise ValueError(f"Task not found: {task_id}")
                
            if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                return task.to_dict()
                
            if timeout:
                elapsed = (datetime.now() - start_time).total_seconds()
                if elapsed > timeout:
                    raise TimeoutError(f"Task {task_id} timed out")
                    
            await asyncio.sleep(0.5)
            
    async def _dispatch_loop(self) -> None:
        """Main dispatcher loop."""
        while self._running:
            try:
                # Get next task from queue
                try:
                    _, _, task_id = await asyncio.wait_for(
                        self._task_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                    
                task = self._tasks.get(task_id)
                if not task or task.status != TaskStatus.PENDING:
                    continue
                    
                # Find available agent
                agent = await self._find_available_agent(task.task_type)
                
                if agent:
                    await self._assign_task(task, agent)
                else:
                    # Re-queue if no agent available
                    await self._enqueue_task(task)
                    await asyncio.sleep(0.1)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Dispatcher error: {e}")
                await asyncio.sleep(1)
                
    async def _find_available_agent(self, task_type: str) -> Optional[Agent]:
        """Find an available agent for a task type."""
        for agent in self._agents.values():
            if agent.status == AgentStatus.IDLE:
                # Check if agent can handle this task type
                if not agent.capabilities or task_type in agent.capabilities:
                    return agent
        return None
        
    async def _assign_task(self, task: Task, agent: Agent) -> None:
        """Assign a task to an agent."""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        task.assigned_agent = agent.id
        
        agent.status = AgentStatus.BUSY
        agent.current_task = task.id
        
        logger.debug(f"Assigned task {task.id} to agent {agent.id}")
        
        # Execute task
        asyncio.create_task(self._execute_task(task, agent))
        
    async def _execute_task(self, task: Task, agent: Agent) -> None:
        """Execute a task."""
        try:
            handler = self._task_handlers.get(task.task_type)
            
            if not handler:
                raise ValueError(f"No handler for task type: {task.task_type}")
                
            # Execute with timeout
            result = await asyncio.wait_for(
                handler(task.payload),
                timeout=self.config.task_timeout_seconds
            )
            
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.completed_at = datetime.now()
            agent.tasks_completed += 1
            
            logger.debug(f"Task {task.id} completed successfully")
            
        except asyncio.TimeoutError:
            task.error = "Task timed out"
            await self._handle_task_failure(task, agent)
            
        except Exception as e:
            task.error = str(e)
            await self._handle_task_failure(task, agent)
            
        finally:
            agent.status = AgentStatus.IDLE
            agent.current_task = None
            
    async def _handle_task_failure(self, task: Task, agent: Agent) -> None:
        """Handle a failed task."""
        logger.error(f"Task {task.id} failed: {task.error}")
        
        agent.tasks_failed += 1
        task.retries += 1
        
        if task.retries < task.max_retries:
            task.status = TaskStatus.RETRYING
            await asyncio.sleep(self.config.retry_delay_seconds)
            task.status = TaskStatus.PENDING
            task.assigned_agent = None
            await self._enqueue_task(task)
            logger.info(f"Retrying task {task.id} (attempt {task.retries})")
        else:
            task.status = TaskStatus.FAILED
            task.completed_at = datetime.now()
            logger.error(f"Task {task.id} failed after {task.retries} retries")
            
    async def _monitor_loop(self) -> None:
        """Monitor agents and tasks."""
        while self._running:
            try:
                await asyncio.sleep(self.config.heartbeat_interval_seconds)
                
                # Check for stale agents
                now = datetime.now()
                stale_threshold = self.config.heartbeat_interval_seconds * 3
                
                for agent_id, agent in list(self._agents.items()):
                    elapsed = (now - agent.last_heartbeat).total_seconds()
                    if elapsed > stale_threshold and agent.status != AgentStatus.OFFLINE:
                        logger.warning(f"Agent {agent_id} is stale, marking offline")
                        agent.status = AgentStatus.OFFLINE
                        
                        # Re-queue task if any
                        if agent.current_task:
                            task = self._tasks.get(agent.current_task)
                            if task:
                                task.status = TaskStatus.PENDING
                                task.assigned_agent = None
                                await self._enqueue_task(task)
                                
                # Auto-scaling
                if self.config.enable_auto_scaling:
                    await self._check_auto_scale()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                
    async def _check_auto_scale(self) -> None:
        """Check if scaling is needed."""
        queue_size = self._task_queue.qsize()
        utilization = queue_size / self.config.max_queue_size
        active_agents = sum(1 for a in self._agents.values() if a.status != AgentStatus.OFFLINE)
        
        if utilization > self.config.scale_up_threshold:
            if active_agents < self.config.max_agents:
                logger.info(f"High load ({utilization:.1%}), consider scaling up")
                # Emit scaling event for cloud orchestrator
                
        elif utilization < self.config.scale_down_threshold:
            if active_agents > self.config.min_agents:
                logger.info(f"Low load ({utilization:.1%}), consider scaling down")
                # Emit scaling event for cloud orchestrator
                
    def heartbeat(self, agent_id: str) -> None:
        """Record agent heartbeat."""
        agent = self._agents.get(agent_id)
        if agent:
            agent.last_heartbeat = datetime.now()
            if agent.status == AgentStatus.OFFLINE:
                agent.status = AgentStatus.IDLE
                
    def get_stats(self) -> Dict[str, Any]:
        """Get coordinator statistics."""
        agents_by_status = {}
        for agent in self._agents.values():
            status = agent.status.value
            agents_by_status[status] = agents_by_status.get(status, 0) + 1
            
        tasks_by_status = {}
        for task in self._tasks.values():
            status = task.status.value
            tasks_by_status[status] = tasks_by_status.get(status, 0) + 1
            
        return {
            "total_agents": len(self._agents),
            "agents_by_status": agents_by_status,
            "queue_size": self._task_queue.qsize(),
            "total_tasks": len(self._tasks),
            "tasks_by_status": tasks_by_status,
        }
