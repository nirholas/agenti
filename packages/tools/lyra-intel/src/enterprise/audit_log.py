"""
Comprehensive audit logging for enterprise compliance.
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class AuditCategory(Enum):
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    CONFIGURATION = "configuration"
    ADMIN_ACTION = "admin_action"
    API_CALL = "api_call"
    SECURITY = "security"
    SYSTEM = "system"


class AuditSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AuditAction(Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"
    ANALYSIS_STARTED = "analysis_started"
    ANALYSIS_COMPLETED = "analysis_completed"
    SECURITY_ALERT = "security_alert"
    CONFIG_CHANGED = "config_changed"


@dataclass
class AuditConfig:
    storage_path: str = "./audit_logs"
    retention_days: int = 365
    enable_hashing: bool = True
    max_events_in_memory: int = 10000


@dataclass
class AuditEvent:
    id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    category: AuditCategory = AuditCategory.SYSTEM
    action: AuditAction = AuditAction.READ
    severity: AuditSeverity = AuditSeverity.INFO
    tenant_id: str = ""
    user_id: str = ""
    user_email: str = ""
    ip_address: str = ""
    resource_type: str = ""
    resource_id: str = ""
    description: str = ""
    details: dict = field(default_factory=dict)
    success: bool = True
    error_message: str = ""
    event_hash: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "category": self.category.value,
            "action": self.action.value,
            "severity": self.severity.value,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "description": self.description,
            "success": self.success,
        }

    def compute_hash(self, previous_hash: str = "") -> str:
        content = json.dumps({
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action.value,
            "details": self.details,
            "previous_hash": previous_hash,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


class AuditLogger:
    def __init__(self, config: Optional[AuditConfig] = None):
        self.config = config or AuditConfig()
        self.events: list[AuditEvent] = []
        self.last_hash: str = ""

    def log(
        self,
        category: AuditCategory,
        action: AuditAction,
        description: str,
        tenant_id: str = "",
        user_id: str = "",
        resource_type: str = "",
        resource_id: str = "",
        details: Optional[dict] = None,
        ip_address: str = "",
        success: bool = True,
        error_message: str = "",
        severity: Optional[AuditSeverity] = None,
    ) -> AuditEvent:
        if severity is None:
            severity = AuditSeverity.ERROR if not success else AuditSeverity.INFO

        event = AuditEvent(
            category=category,
            action=action,
            severity=severity,
            description=description,
            tenant_id=tenant_id,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            success=success,
            error_message=error_message,
        )

        if self.config.enable_hashing:
            event.event_hash = event.compute_hash(self.last_hash)
            self.last_hash = event.event_hash

        self.events.append(event)
        return event

    def log_login(self, user_id: str, user_email: str, tenant_id: str = "", ip_address: str = "", success: bool = True) -> AuditEvent:
        return self.log(
            category=AuditCategory.AUTHENTICATION,
            action=AuditAction.LOGIN if success else AuditAction.LOGIN_FAILED,
            description=f"User {'logged in' if success else 'failed to log in'}: {user_email}",
            tenant_id=tenant_id,
            user_id=user_id,
            ip_address=ip_address,
            success=success,
        )

    def log_data_access(self, user_id: str, resource_type: str, resource_id: str, action: AuditAction = AuditAction.READ, tenant_id: str = "") -> AuditEvent:
        return self.log(
            category=AuditCategory.DATA_ACCESS,
            action=action,
            description=f"User {user_id} {action.value} {resource_type} {resource_id}",
            tenant_id=tenant_id,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
        )

    def log_security_event(self, description: str, tenant_id: str = "", ip_address: str = "", details: Optional[dict] = None) -> AuditEvent:
        return self.log(
            category=AuditCategory.SECURITY,
            action=AuditAction.SECURITY_ALERT,
            description=description,
            tenant_id=tenant_id,
            ip_address=ip_address,
            details=details,
            severity=AuditSeverity.CRITICAL,
        )

    def query(
        self,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        category: Optional[AuditCategory] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> list[AuditEvent]:
        results = []
        for event in reversed(self.events):
            if tenant_id and event.tenant_id != tenant_id:
                continue
            if user_id and event.user_id != user_id:
                continue
            if category and event.category != category:
                continue
            if start_time and event.timestamp < start_time:
                continue
            if end_time and event.timestamp > end_time:
                continue
            results.append(event)
            if len(results) >= limit:
                break
        return results

    def export(self, format: str = "json") -> str:
        if format == "json":
            return json.dumps([e.to_dict() for e in self.events], indent=2)
        return ""

    def verify_chain(self) -> tuple[bool, list[str]]:
        if not self.config.enable_hashing:
            return True, []
        invalid_events = []
        previous_hash = ""
        for event in self.events:
            expected_hash = event.compute_hash(previous_hash)
            if event.event_hash != expected_hash:
                invalid_events.append(event.id)
            previous_hash = event.event_hash
        return len(invalid_events) == 0, invalid_events
