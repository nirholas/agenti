"""
Cluster management for distributed analysis.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class NodeStatus(Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    DRAINING = "draining"
    FAILED = "failed"


class ClusterMode(Enum):
    STANDALONE = "standalone"
    LEADER_FOLLOWER = "leader_follower"
    PEER_TO_PEER = "peer_to_peer"
    KUBERNETES = "kubernetes"


@dataclass
class ClusterConfig:
    mode: ClusterMode = ClusterMode.STANDALONE
    min_workers: int = 1
    max_workers: int = 100
    auto_scale: bool = True
    health_check_interval: int = 30
    task_timeout: int = 3600
    enable_fault_tolerance: bool = True


@dataclass
class WorkerNode:
    id: str = field(default_factory=lambda: str(uuid4()))
    hostname: str = ""
    ip_address: str = ""
    port: int = 8080
    status: NodeStatus = NodeStatus.OFFLINE
    capabilities: list[str] = field(default_factory=list)
    cpu_cores: int = 1
    memory_gb: float = 1.0
    current_load: float = 0.0
    tasks_completed: int = 0
    tasks_failed: int = 0
    registered_at: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "hostname": self.hostname,
            "status": self.status.value,
            "cpu_cores": self.cpu_cores,
            "memory_gb": self.memory_gb,
            "current_load": self.current_load,
            "tasks_completed": self.tasks_completed,
        }

    def is_healthy(self, timeout_seconds: int = 60) -> bool:
        if self.status in [NodeStatus.OFFLINE, NodeStatus.FAILED]:
            return False
        age = (datetime.utcnow() - self.last_heartbeat).total_seconds()
        return age < timeout_seconds


class ClusterManager:
    def __init__(self, config: Optional[ClusterConfig] = None):
        self.config = config or ClusterConfig()
        self.nodes: dict[str, WorkerNode] = {}
        self.leader_id: Optional[str] = None
        self.self_id: str = str(uuid4())
        self._running = False

    async def start(self) -> None:
        self._running = True
        if self.config.mode == ClusterMode.LEADER_FOLLOWER:
            await self._elect_leader()

    async def stop(self) -> None:
        self._running = False
        for node in self.nodes.values():
            node.status = NodeStatus.OFFLINE

    def register_node(
        self,
        hostname: str,
        ip_address: str,
        port: int = 8080,
        cpu_cores: int = 1,
        memory_gb: float = 1.0,
        capabilities: Optional[list[str]] = None,
    ) -> WorkerNode:
        node = WorkerNode(
            hostname=hostname,
            ip_address=ip_address,
            port=port,
            cpu_cores=cpu_cores,
            memory_gb=memory_gb,
            capabilities=capabilities or ["analysis", "search"],
            status=NodeStatus.ONLINE,
        )
        self.nodes[node.id] = node
        return node

    def deregister_node(self, node_id: str) -> bool:
        if node_id in self.nodes:
            del self.nodes[node_id]
            return True
        return False

    def get_node(self, node_id: str) -> Optional[WorkerNode]:
        return self.nodes.get(node_id)

    def get_available_nodes(self) -> list[WorkerNode]:
        return [n for n in self.nodes.values() if n.status == NodeStatus.ONLINE and n.current_load < 0.9]

    def get_best_node(self, required_capability: Optional[str] = None) -> Optional[WorkerNode]:
        available = self.get_available_nodes()
        if required_capability:
            available = [n for n in available if required_capability in n.capabilities]
        if not available:
            return None
        return min(available, key=lambda n: n.current_load)

    def update_heartbeat(self, node_id: str, load: float = 0.0) -> bool:
        node = self.nodes.get(node_id)
        if not node:
            return False
        node.last_heartbeat = datetime.utcnow()
        node.current_load = load
        if node.status == NodeStatus.OFFLINE:
            node.status = NodeStatus.ONLINE
        return True

    def check_health(self) -> dict:
        healthy = 0
        unhealthy = 0
        for node in self.nodes.values():
            if node.is_healthy(self.config.health_check_interval * 2):
                healthy += 1
            else:
                unhealthy += 1
                if node.status == NodeStatus.ONLINE:
                    node.status = NodeStatus.FAILED
        return {
            "total_nodes": len(self.nodes),
            "healthy": healthy,
            "unhealthy": unhealthy,
            "health_percentage": healthy / len(self.nodes) * 100 if self.nodes else 0,
        }

    def get_cluster_capacity(self) -> dict:
        total_cpu = sum(n.cpu_cores for n in self.nodes.values())
        total_memory = sum(n.memory_gb for n in self.nodes.values())
        used_capacity = sum(n.current_load * n.cpu_cores for n in self.nodes.values())
        return {
            "total_cpu_cores": total_cpu,
            "total_memory_gb": total_memory,
            "available_capacity": total_cpu - used_capacity,
            "utilization": used_capacity / total_cpu * 100 if total_cpu > 0 else 0,
        }

    async def _elect_leader(self) -> None:
        if not self.nodes:
            self.leader_id = self.self_id
            return
        candidates = sorted(self.nodes.values(), key=lambda n: n.registered_at)
        if candidates:
            self.leader_id = candidates[0].id

    def is_leader(self) -> bool:
        return self.leader_id == self.self_id

    async def scale_up(self, count: int = 1) -> list[WorkerNode]:
        if not self.config.auto_scale:
            return []
        # In production, would provision new cloud instances
        new_nodes = []
        for i in range(count):
            if len(self.nodes) >= self.config.max_workers:
                break
            node = self.register_node(
                hostname=f"worker-{len(self.nodes)+1}",
                ip_address=f"10.0.0.{len(self.nodes)+1}",
                cpu_cores=4,
                memory_gb=8.0,
            )
            new_nodes.append(node)
        return new_nodes

    async def scale_down(self, count: int = 1) -> list[str]:
        if not self.config.auto_scale:
            return []
        removed = []
        nodes_by_load = sorted(self.nodes.values(), key=lambda n: n.current_load)
        for node in nodes_by_load[:count]:
            if len(self.nodes) <= self.config.min_workers:
                break
            if node.current_load == 0:
                removed.append(node.id)
                self.deregister_node(node.id)
        return removed

    def get_stats(self) -> dict:
        health = self.check_health()
        capacity = self.get_cluster_capacity()
        return {
            **health,
            **capacity,
            "mode": self.config.mode.value,
            "leader_id": self.leader_id,
            "is_leader": self.is_leader(),
            "total_tasks_completed": sum(n.tasks_completed for n in self.nodes.values()),
            "total_tasks_failed": sum(n.tasks_failed for n in self.nodes.values()),
        }
