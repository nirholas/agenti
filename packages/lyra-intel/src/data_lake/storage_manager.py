"""
Storage management for data lake lifecycle.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class StorageTier(Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    ARCHIVE = "archive"


class LifecycleAction(Enum):
    TRANSITION = "transition"
    DELETE = "delete"
    ARCHIVE = "archive"


@dataclass
class StorageConfig:
    hot_retention_days: int = 30
    warm_retention_days: int = 90
    cold_retention_days: int = 365
    archive_retention_days: int = 2555  # 7 years
    auto_tiering: bool = True
    compression_enabled: bool = True


@dataclass
class StorageObject:
    id: str = field(default_factory=lambda: str(uuid4()))
    path: str = ""
    size_bytes: int = 0
    tier: StorageTier = StorageTier.HOT
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed: datetime = field(default_factory=datetime.utcnow)
    access_count: int = 0
    compressed: bool = False


class StorageManager:
    def __init__(self, config: Optional[StorageConfig] = None):
        self.config = config or StorageConfig()
        self.objects: dict[str, StorageObject] = {}
        self.lifecycle_rules: list[dict] = []

    def add_object(
        self,
        path: str,
        size_bytes: int,
        tier: StorageTier = StorageTier.HOT,
    ) -> StorageObject:
        obj = StorageObject(
            path=path,
            size_bytes=size_bytes,
            tier=tier,
            compressed=self.config.compression_enabled,
        )
        self.objects[obj.id] = obj
        return obj

    def get_object(self, object_id: str) -> Optional[StorageObject]:
        return self.objects.get(object_id)

    def access_object(self, object_id: str) -> Optional[StorageObject]:
        obj = self.objects.get(object_id)
        if obj:
            obj.last_accessed = datetime.utcnow()
            obj.access_count += 1
        return obj

    def transition_tier(self, object_id: str, new_tier: StorageTier) -> bool:
        obj = self.objects.get(object_id)
        if not obj:
            return False
        obj.tier = new_tier
        return True

    def delete_object(self, object_id: str) -> bool:
        if object_id in self.objects:
            del self.objects[object_id]
            return True
        return False

    def add_lifecycle_rule(
        self,
        name: str,
        prefix: str,
        transitions: list[dict],
        expiration_days: Optional[int] = None,
    ) -> None:
        rule = {
            "name": name,
            "prefix": prefix,
            "transitions": transitions,
            "expiration_days": expiration_days,
        }
        self.lifecycle_rules.append(rule)

    def apply_lifecycle_rules(self) -> dict:
        transitioned = 0
        deleted = 0
        now = datetime.utcnow()

        for obj in list(self.objects.values()):
            age_days = (now - obj.created_at).days

            if self.config.auto_tiering:
                # Auto-tier based on age
                if age_days > self.config.cold_retention_days and obj.tier != StorageTier.ARCHIVE:
                    obj.tier = StorageTier.ARCHIVE
                    transitioned += 1
                elif age_days > self.config.warm_retention_days and obj.tier == StorageTier.HOT:
                    obj.tier = StorageTier.COLD
                    transitioned += 1
                elif age_days > self.config.hot_retention_days and obj.tier == StorageTier.HOT:
                    obj.tier = StorageTier.WARM
                    transitioned += 1

            # Apply expiration rules
            for rule in self.lifecycle_rules:
                if rule.get("expiration_days") and age_days > rule["expiration_days"]:
                    if rule.get("prefix") and obj.path.startswith(rule["prefix"]):
                        del self.objects[obj.id]
                        deleted += 1
                        break

        return {
            "objects_transitioned": transitioned,
            "objects_deleted": deleted,
        }

    def get_storage_by_tier(self) -> dict[str, dict]:
        by_tier: dict[str, dict] = {}
        for obj in self.objects.values():
            tier = obj.tier.value
            if tier not in by_tier:
                by_tier[tier] = {"count": 0, "size_bytes": 0}
            by_tier[tier]["count"] += 1
            by_tier[tier]["size_bytes"] += obj.size_bytes
        return by_tier

    def get_stats(self) -> dict:
        by_tier = self.get_storage_by_tier()
        total_size = sum(t.get("size_bytes", 0) for t in by_tier.values())

        return {
            "total_objects": len(self.objects),
            "total_size_bytes": total_size,
            "total_size_gb": total_size / 1024 / 1024 / 1024,
            "by_tier": by_tier,
            "lifecycle_rules": len(self.lifecycle_rules),
            "auto_tiering": self.config.auto_tiering,
        }

    def estimate_cost(self, price_per_gb_hot: float = 0.023, price_per_gb_cold: float = 0.01) -> dict:
        by_tier = self.get_storage_by_tier()
        costs = {}
        total = 0.0

        tier_prices = {
            "hot": price_per_gb_hot,
            "warm": price_per_gb_hot * 0.7,
            "cold": price_per_gb_cold,
            "archive": price_per_gb_cold * 0.3,
        }

        for tier, data in by_tier.items():
            gb = data["size_bytes"] / 1024 / 1024 / 1024
            price = tier_prices.get(tier, price_per_gb_hot)
            cost = gb * price
            costs[tier] = cost
            total += cost

        return {
            "by_tier": costs,
            "total_monthly": total,
            "total_yearly": total * 12,
        }
