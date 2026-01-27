"""
Data partitioning for distributed processing.
"""

import hashlib
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterator, Optional


class PartitionStrategy(Enum):
    HASH = "hash"
    RANGE = "range"
    ROUND_ROBIN = "round_robin"
    SIZE_BASED = "size_based"
    DIRECTORY = "directory"
    CUSTOM = "custom"


@dataclass
class Partition:
    id: int = 0
    start_key: Optional[Any] = None
    end_key: Optional[Any] = None
    items: list[Any] = field(default_factory=list)
    size_bytes: int = 0
    item_count: int = 0

    def add_item(self, item: Any, size: int = 0) -> None:
        self.items.append(item)
        self.item_count += 1
        self.size_bytes += size


class DataPartitioner:
    def __init__(self, strategy: PartitionStrategy = PartitionStrategy.HASH, num_partitions: int = 4):
        self.strategy = strategy
        self.num_partitions = num_partitions
        self.partitions: list[Partition] = []

    def partition(self, data: list[Any], key_func=None, size_func=None) -> list[Partition]:
        self.partitions = [Partition(id=i) for i in range(self.num_partitions)]

        if self.strategy == PartitionStrategy.HASH:
            self._hash_partition(data, key_func)
        elif self.strategy == PartitionStrategy.RANGE:
            self._range_partition(data, key_func)
        elif self.strategy == PartitionStrategy.ROUND_ROBIN:
            self._round_robin_partition(data)
        elif self.strategy == PartitionStrategy.SIZE_BASED:
            self._size_based_partition(data, size_func)
        else:
            self._round_robin_partition(data)

        return self.partitions

    def _hash_partition(self, data: list[Any], key_func=None) -> None:
        for item in data:
            key = key_func(item) if key_func else str(item)
            hash_val = int(hashlib.md5(str(key).encode()).hexdigest(), 16)
            partition_id = hash_val % self.num_partitions
            self.partitions[partition_id].add_item(item)

    def _range_partition(self, data: list[Any], key_func=None) -> None:
        sorted_data = sorted(data, key=key_func or (lambda x: x))
        partition_size = len(sorted_data) // self.num_partitions
        for i, item in enumerate(sorted_data):
            partition_id = min(i // partition_size, self.num_partitions - 1) if partition_size else 0
            self.partitions[partition_id].add_item(item)

    def _round_robin_partition(self, data: list[Any]) -> None:
        for i, item in enumerate(data):
            partition_id = i % self.num_partitions
            self.partitions[partition_id].add_item(item)

    def _size_based_partition(self, data: list[Any], size_func=None) -> None:
        size_fn = size_func or (lambda x: 1)
        target_size = sum(size_fn(item) for item in data) / self.num_partitions
        current_partition = 0
        current_size = 0

        for item in data:
            item_size = size_fn(item)
            if current_size + item_size > target_size and current_partition < self.num_partitions - 1:
                current_partition += 1
                current_size = 0
            self.partitions[current_partition].add_item(item, item_size)
            current_size += item_size

    def get_partition(self, key: Any, key_func=None) -> int:
        if self.strategy == PartitionStrategy.HASH:
            key_str = key_func(key) if key_func else str(key)
            hash_val = int(hashlib.md5(str(key_str).encode()).hexdigest(), 16)
            return hash_val % self.num_partitions
        return 0

    def rebalance(self) -> None:
        all_items = []
        for partition in self.partitions:
            all_items.extend(partition.items)
        self.partitions = [Partition(id=i) for i in range(self.num_partitions)]
        self._round_robin_partition(all_items)

    def get_stats(self) -> dict:
        sizes = [p.item_count for p in self.partitions]
        return {
            "num_partitions": self.num_partitions,
            "strategy": self.strategy.value,
            "total_items": sum(sizes),
            "partition_sizes": sizes,
            "min_size": min(sizes) if sizes else 0,
            "max_size": max(sizes) if sizes else 0,
            "imbalance_ratio": max(sizes) / min(sizes) if sizes and min(sizes) > 0 else 0,
        }

    def iterate_partitions(self) -> Iterator[Partition]:
        for partition in self.partitions:
            yield partition
