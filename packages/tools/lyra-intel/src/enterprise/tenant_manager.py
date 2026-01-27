"""
Multi-tenant management for enterprise deployments.
"""

import secrets
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class TenantTier(Enum):
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    UNLIMITED = "unlimited"


class TenantStatus(Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING = "pending"
    TRIAL = "trial"
    DEACTIVATED = "deactivated"


@dataclass
class ResourceQuota:
    max_repositories: int = 10
    max_users: int = 5
    max_storage_gb: float = 10.0
    max_api_calls_per_day: int = 10000
    max_concurrent_analyses: int = 5
    max_agents: int = 10
    enable_cloud_analysis: bool = False
    enable_ai_features: bool = True
    enable_sso: bool = False
    priority_support: bool = False


@dataclass
class TenantConfig:
    storage_path: str = "./tenants"
    default_tier: TenantTier = TenantTier.FREE
    enable_isolation: bool = True
    enable_quotas: bool = True


@dataclass
class Tenant:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    tier: TenantTier = TenantTier.FREE
    status: TenantStatus = TenantStatus.ACTIVE
    api_key: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    quota: ResourceQuota = field(default_factory=ResourceQuota)
    current_usage: dict = field(default_factory=dict)
    owner_email: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    settings: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "tier": self.tier.value,
            "status": self.status.value,
        }


class TenantManager:
    TIER_QUOTAS = {
        TenantTier.FREE: ResourceQuota(max_repositories=3, max_users=2, max_storage_gb=1.0),
        TenantTier.STARTER: ResourceQuota(max_repositories=10, max_users=5, max_storage_gb=10.0),
        TenantTier.PROFESSIONAL: ResourceQuota(max_repositories=50, max_users=25, max_storage_gb=100.0, enable_cloud_analysis=True, enable_sso=True),
        TenantTier.ENTERPRISE: ResourceQuota(max_repositories=500, max_users=500, max_storage_gb=1000.0, enable_cloud_analysis=True, enable_sso=True, priority_support=True),
        TenantTier.UNLIMITED: ResourceQuota(max_repositories=999999, max_users=999999, max_storage_gb=999999.0, enable_cloud_analysis=True, enable_sso=True, priority_support=True),
    }

    def __init__(self, config: Optional[TenantConfig] = None):
        self.config = config or TenantConfig()
        self.tenants: dict[str, Tenant] = {}
        self.tenants_by_slug: dict[str, str] = {}
        self.tenants_by_api_key: dict[str, str] = {}

    def create_tenant(self, name: str, owner_email: str, tier: TenantTier = TenantTier.FREE) -> Tenant:
        slug = name.lower().replace(" ", "-")
        quota = self.TIER_QUOTAS.get(tier, ResourceQuota())
        tenant = Tenant(name=name, slug=slug, tier=tier, owner_email=owner_email, quota=quota)
        self.tenants[tenant.id] = tenant
        self.tenants_by_slug[slug] = tenant.id
        self.tenants_by_api_key[tenant.api_key] = tenant.id
        return tenant

    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        return self.tenants.get(tenant_id)

    def get_tenant_by_api_key(self, api_key: str) -> Optional[Tenant]:
        tenant_id = self.tenants_by_api_key.get(api_key)
        return self.tenants.get(tenant_id) if tenant_id else None

    def check_quota(self, tenant_id: str, resource: str, amount: int = 1) -> bool:
        # Validate resource name to prevent attribute injection
        valid_resources = ["repositories", "users", "storage_gb", "api_calls_per_day", "concurrent_analyses", "agents"]
        if resource not in valid_resources:
            return False
        tenant = self.tenants.get(tenant_id)
        if not tenant or not self.config.enable_quotas:
            return True
        current = tenant.current_usage.get(resource, 0)
        attr_name = f"max_{resource}"
        max_allowed = getattr(tenant.quota, attr_name, float("inf"))
        return current + amount <= max_allowed

    def record_usage(self, tenant_id: str, resource: str, amount: int = 1) -> bool:
        tenant = self.tenants.get(tenant_id)
        if not tenant:
            return False
        tenant.current_usage[resource] = tenant.current_usage.get(resource, 0) + amount
        return True

    def list_tenants(self, status: Optional[TenantStatus] = None) -> list[Tenant]:
        return [t for t in self.tenants.values() if status is None or t.status == status]
