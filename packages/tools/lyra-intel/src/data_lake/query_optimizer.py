"""
Query optimization for data lake analytics.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class OptimizationType(Enum):
    PREDICATE_PUSHDOWN = "predicate_pushdown"
    PROJECTION_PRUNING = "projection_pruning"
    PARTITION_PRUNING = "partition_pruning"
    JOIN_REORDER = "join_reorder"
    AGGREGATION_PUSHDOWN = "aggregation_pushdown"


@dataclass
class QueryPlan:
    id: str = field(default_factory=lambda: str(uuid4()))
    original_query: str = ""
    optimized_query: str = ""
    optimizations_applied: list[OptimizationType] = field(default_factory=list)
    estimated_cost: float = 0.0
    estimated_rows: int = 0
    partitions_scanned: int = 0
    files_scanned: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "optimizations": [o.value for o in self.optimizations_applied],
            "estimated_cost": self.estimated_cost,
            "estimated_rows": self.estimated_rows,
            "partitions_scanned": self.partitions_scanned,
        }


class QueryOptimizer:
    def __init__(self):
        self.statistics: dict[str, dict] = {}  # table -> stats
        self.query_cache: dict[str, QueryPlan] = {}

    def analyze(self, query: str) -> QueryPlan:
        # Check cache
        query_hash = hash(query)
        if str(query_hash) in self.query_cache:
            return self.query_cache[str(query_hash)]

        plan = QueryPlan(original_query=query)
        optimized = query

        # Apply optimizations
        optimized, applied = self._optimize(optimized)
        plan.optimized_query = optimized
        plan.optimizations_applied = applied

        # Estimate cost
        plan.estimated_cost = self._estimate_cost(optimized)
        plan.estimated_rows = self._estimate_rows(optimized)

        self.query_cache[str(query_hash)] = plan
        return plan

    def _optimize(self, query: str) -> tuple[str, list[OptimizationType]]:
        applied = []
        optimized = query

        # Predicate pushdown (simplified)
        if "WHERE" in query.upper():
            applied.append(OptimizationType.PREDICATE_PUSHDOWN)

        # Projection pruning
        if "SELECT *" not in query.upper():
            applied.append(OptimizationType.PROJECTION_PRUNING)

        # Partition pruning
        if any(k in query.lower() for k in ["year=", "month=", "day=", "date="]):
            applied.append(OptimizationType.PARTITION_PRUNING)

        # Join reorder
        if query.upper().count("JOIN") > 1:
            applied.append(OptimizationType.JOIN_REORDER)

        return optimized, applied

    def _estimate_cost(self, query: str) -> float:
        base_cost = 1.0
        if "SELECT *" in query.upper():
            base_cost *= 2.0
        if "JOIN" in query.upper():
            base_cost *= 1.5 * query.upper().count("JOIN")
        if "GROUP BY" in query.upper():
            base_cost *= 1.3
        if "ORDER BY" in query.upper():
            base_cost *= 1.2
        return base_cost

    def _estimate_rows(self, query: str) -> int:
        base_rows = 10000
        if "WHERE" in query.upper():
            base_rows = int(base_rows * 0.3)
        if "LIMIT" in query.upper():
            # Extract limit value
            import re
            match = re.search(r'LIMIT\s+(\d+)', query, re.IGNORECASE)
            if match:
                limit = int(match.group(1))
                base_rows = min(base_rows, limit)
        return base_rows

    def update_statistics(self, table: str, stats: dict) -> None:
        self.statistics[table] = stats

    def explain(self, query: str) -> str:
        plan = self.analyze(query)
        lines = [
            "QUERY PLAN",
            "=" * 50,
            f"Original: {plan.original_query[:100]}...",
            "",
            "Optimizations Applied:",
        ]
        for opt in plan.optimizations_applied:
            lines.append(f"  - {opt.value}")
        lines.extend([
            "",
            f"Estimated Cost: {plan.estimated_cost:.2f}",
            f"Estimated Rows: {plan.estimated_rows}",
            f"Partitions to Scan: {plan.partitions_scanned}",
        ])
        return "\n".join(lines)

    def clear_cache(self) -> None:
        self.query_cache = {}
