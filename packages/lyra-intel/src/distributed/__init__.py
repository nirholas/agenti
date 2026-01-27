"""
Distributed computing for massive-scale analysis.
"""

from .cluster_manager import ClusterManager, ClusterConfig, WorkerNode
from .task_scheduler import DistributedTaskScheduler, DistributedTask
from .data_partitioner import DataPartitioner, PartitionStrategy
from .consensus import ConsensusManager, ConsensusProtocol

__all__ = [
    "ClusterManager",
    "ClusterConfig",
    "WorkerNode",
    "DistributedTaskScheduler",
    "DistributedTask",
    "DataPartitioner",
    "PartitionStrategy",
    "ConsensusManager",
    "ConsensusProtocol",
]
