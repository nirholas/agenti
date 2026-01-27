"""
Data governance and policy enforcement for enterprise data management.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from uuid import uuid4


class DataClassification(Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    TOP_SECRET = "top_secret"


class PolicyType(Enum):
    RETENTION = "retention"
    ACCESS = "access"
    ENCRYPTION = "encryption"
    MASKING = "masking"
    ARCHIVAL = "archival"
    DELETION = "deletion"


class PolicyStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"
    EXPIRED = "expired"


@dataclass
class DataPolicy:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    policy_type: PolicyType = PolicyType.RETENTION
    classification: DataClassification = DataClassification.INTERNAL
    status: PolicyStatus = PolicyStatus.ACTIVE
    rules: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "policy_type": self.policy_type.value,
            "classification": self.classification.value,
            "status": self.status.value,
        }


@dataclass
class RetentionPolicy:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    data_types: list[str] = field(default_factory=list)
    retention_days: int = 365
    archive_after_days: int = 180
    delete_after_days: int = 730
    classification: DataClassification = DataClassification.INTERNAL
    exceptions: list[str] = field(default_factory=list)
    status: PolicyStatus = PolicyStatus.ACTIVE


@dataclass
class DataAsset:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    asset_type: str = ""
    classification: DataClassification = DataClassification.INTERNAL
    owner: str = ""
    location: str = ""
    size_bytes: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed: Optional[datetime] = None
    policies: list[str] = field(default_factory=list)
    tags: dict = field(default_factory=dict)


class DataGovernance:
    def __init__(self):
        self.policies: dict[str, DataPolicy] = {}
        self.retention_policies: dict[str, RetentionPolicy] = {}
        self.data_assets: dict[str, DataAsset] = {}
        self.policy_violations: list[dict] = []

    def create_policy(
        self,
        name: str,
        policy_type: PolicyType,
        classification: DataClassification = DataClassification.INTERNAL,
        rules: Optional[dict] = None,
        created_by: str = "",
    ) -> DataPolicy:
        policy = DataPolicy(
            name=name,
            policy_type=policy_type,
            classification=classification,
            rules=rules or {},
            created_by=created_by,
        )
        self.policies[policy.id] = policy
        return policy

    def create_retention_policy(
        self,
        name: str,
        data_types: list[str],
        retention_days: int = 365,
        archive_after_days: int = 180,
        delete_after_days: int = 730,
        classification: DataClassification = DataClassification.INTERNAL,
    ) -> RetentionPolicy:
        policy = RetentionPolicy(
            name=name,
            data_types=data_types,
            retention_days=retention_days,
            archive_after_days=archive_after_days,
            delete_after_days=delete_after_days,
            classification=classification,
        )
        self.retention_policies[policy.id] = policy
        return policy

    def register_data_asset(
        self,
        name: str,
        asset_type: str,
        classification: DataClassification = DataClassification.INTERNAL,
        owner: str = "",
        location: str = "",
        size_bytes: int = 0,
    ) -> DataAsset:
        asset = DataAsset(
            name=name,
            asset_type=asset_type,
            classification=classification,
            owner=owner,
            location=location,
            size_bytes=size_bytes,
        )
        self.data_assets[asset.id] = asset
        self._auto_apply_policies(asset)
        return asset

    def _auto_apply_policies(self, asset: DataAsset) -> None:
        for policy_id, policy in self.policies.items():
            if policy.status == PolicyStatus.ACTIVE and policy.classification == asset.classification:
                if policy_id not in asset.policies:
                    asset.policies.append(policy_id)

    def check_compliance(self, asset_id: str) -> dict:
        asset = self.data_assets.get(asset_id)
        if not asset:
            return {"compliant": False, "error": "Asset not found"}

        violations = []
        for policy_id in asset.policies:
            policy = self.policies.get(policy_id)
            if policy and policy.status == PolicyStatus.ACTIVE:
                is_compliant, issues = self._check_policy_compliance(asset, policy)
                if not is_compliant:
                    violations.extend(issues)

        return {
            "compliant": len(violations) == 0,
            "violations": violations,
            "asset_id": asset_id,
            "policies_checked": len(asset.policies),
        }

    def _check_policy_compliance(self, asset: DataAsset, policy: DataPolicy) -> tuple[bool, list[str]]:
        issues = []
        # Classification ordering: public=0, internal=1, confidential=2, restricted=3, top_secret=4
        classification_order = {
            DataClassification.PUBLIC: 0,
            DataClassification.INTERNAL: 1,
            DataClassification.CONFIDENTIAL: 2,
            DataClassification.RESTRICTED: 3,
            DataClassification.TOP_SECRET: 4,
        }
        # Check classification - asset must meet or exceed policy minimum
        asset_level = classification_order.get(asset.classification, 0)
        policy_level = classification_order.get(policy.classification, 0)
        if asset_level < policy_level:
            issues.append(f"Asset classification ({asset.classification.value}) below policy minimum ({policy.classification.value})")
        # Check retention
        if policy.policy_type == PolicyType.RETENTION:
            max_days = policy.rules.get("max_retention_days", 365)
            age_days = (datetime.utcnow() - asset.created_at).days
            if age_days > max_days:
                issues.append(f"Asset exceeds retention period ({age_days} > {max_days} days)")
        return len(issues) == 0, issues

    def get_assets_for_archival(self) -> list[DataAsset]:
        to_archive = []
        for asset in self.data_assets.values():
            for policy_id in asset.policies:
                policy = self.retention_policies.get(policy_id)
                if policy and policy.status == PolicyStatus.ACTIVE:
                    age_days = (datetime.utcnow() - asset.created_at).days
                    if age_days >= policy.archive_after_days:
                        to_archive.append(asset)
                        break
        return to_archive

    def get_assets_for_deletion(self) -> list[DataAsset]:
        to_delete = []
        for asset in self.data_assets.values():
            for policy_id in asset.policies:
                policy = self.retention_policies.get(policy_id)
                if policy and policy.status == PolicyStatus.ACTIVE:
                    age_days = (datetime.utcnow() - asset.created_at).days
                    if age_days >= policy.delete_after_days:
                        to_delete.append(asset)
                        break
        return to_delete

    def get_data_catalog(self) -> dict:
        catalog = {
            "total_assets": len(self.data_assets),
            "by_classification": {},
            "by_type": {},
            "total_size_bytes": 0,
        }
        for asset in self.data_assets.values():
            cat = asset.classification.value
            catalog["by_classification"][cat] = catalog["by_classification"].get(cat, 0) + 1
            catalog["by_type"][asset.asset_type] = catalog["by_type"].get(asset.asset_type, 0) + 1
            catalog["total_size_bytes"] += asset.size_bytes
        return catalog

    def search_assets(
        self,
        classification: Optional[DataClassification] = None,
        asset_type: Optional[str] = None,
        owner: Optional[str] = None,
    ) -> list[DataAsset]:
        results = []
        for asset in self.data_assets.values():
            if classification and asset.classification != classification:
                continue
            if asset_type and asset.asset_type != asset_type:
                continue
            if owner and asset.owner != owner:
                continue
            results.append(asset)
        return results

    def generate_governance_report(self) -> str:
        catalog = self.get_data_catalog()
        compliance_issues = sum(1 for v in self.policy_violations if v.get("status") == "open")

        lines = [
            "# Data Governance Report",
            f"Generated: {datetime.utcnow().isoformat()}",
            "",
            "## Data Catalog Summary",
            f"- Total Assets: {catalog['total_assets']}",
            f"- Total Size: {catalog['total_size_bytes'] / 1024 / 1024:.2f} MB",
            "",
            "### By Classification",
        ]
        for classification, count in catalog["by_classification"].items():
            lines.append(f"- {classification}: {count}")

        lines.extend([
            "",
            "## Policies",
            f"- Active Policies: {sum(1 for p in self.policies.values() if p.status == PolicyStatus.ACTIVE)}",
            f"- Retention Policies: {len(self.retention_policies)}",
            "",
            "## Compliance",
            f"- Open Violations: {compliance_issues}",
            f"- Assets Pending Archival: {len(self.get_assets_for_archival())}",
            f"- Assets Pending Deletion: {len(self.get_assets_for_deletion())}",
        ])

        return "\n".join(lines)
