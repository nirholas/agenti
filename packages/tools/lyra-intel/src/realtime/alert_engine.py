"""
Alert engine for real-time monitoring.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(Enum):
    FIRING = "firing"
    RESOLVED = "resolved"
    SILENCED = "silenced"


class ConditionOperator(Enum):
    GT = "gt"
    LT = "lt"
    GTE = "gte"
    LTE = "lte"
    EQ = "eq"
    NEQ = "neq"


@dataclass
class AlertRule:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    metric: str = ""
    operator: ConditionOperator = ConditionOperator.GT
    threshold: float = 0.0
    severity: AlertSeverity = AlertSeverity.WARNING
    for_duration_seconds: int = 0
    labels: dict = field(default_factory=dict)
    annotations: dict = field(default_factory=dict)
    enabled: bool = True


@dataclass
class Alert:
    id: str = field(default_factory=lambda: str(uuid4()))
    rule_id: str = ""
    rule_name: str = ""
    severity: AlertSeverity = AlertSeverity.WARNING
    status: AlertStatus = AlertStatus.FIRING
    value: float = 0.0
    threshold: float = 0.0
    message: str = ""
    labels: dict = field(default_factory=dict)
    fired_at: datetime = field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "rule_name": self.rule_name,
            "severity": self.severity.value,
            "status": self.status.value,
            "value": self.value,
            "threshold": self.threshold,
            "message": self.message,
            "fired_at": self.fired_at.isoformat(),
        }


class AlertEngine:
    def __init__(self):
        self.rules: dict[str, AlertRule] = {}
        self.alerts: dict[str, Alert] = {}
        self.handlers: list[Callable] = []
        self.pending_alerts: dict[str, datetime] = {}  # rule_id -> first_seen

    def add_rule(
        self,
        name: str,
        metric: str,
        operator: ConditionOperator,
        threshold: float,
        severity: AlertSeverity = AlertSeverity.WARNING,
        for_duration_seconds: int = 0,
        labels: Optional[dict] = None,
        description: str = "",
    ) -> AlertRule:
        rule = AlertRule(
            name=name,
            metric=metric,
            operator=operator,
            threshold=threshold,
            severity=severity,
            for_duration_seconds=for_duration_seconds,
            labels=labels or {},
            description=description,
        )
        self.rules[rule.id] = rule
        return rule

    def remove_rule(self, rule_id: str) -> bool:
        if rule_id in self.rules:
            del self.rules[rule_id]
            return True
        return False

    def register_handler(self, handler: Callable) -> None:
        self.handlers.append(handler)

    def evaluate(self, metrics: dict[str, float]) -> list[Alert]:
        fired_alerts = []

        for rule in self.rules.values():
            if not rule.enabled:
                continue

            value = metrics.get(rule.metric)
            if value is None:
                continue

            is_triggered = self._check_condition(value, rule.operator, rule.threshold)

            if is_triggered:
                if rule.for_duration_seconds > 0:
                    if rule.id not in self.pending_alerts:
                        self.pending_alerts[rule.id] = datetime.utcnow()
                        continue

                    elapsed = (datetime.utcnow() - self.pending_alerts[rule.id]).total_seconds()
                    if elapsed < rule.for_duration_seconds:
                        continue

                alert = self._fire_alert(rule, value)
                fired_alerts.append(alert)
            else:
                # Resolve if was firing
                self._resolve_for_rule(rule.id)
                self.pending_alerts.pop(rule.id, None)

        return fired_alerts

    def _check_condition(self, value: float, operator: ConditionOperator, threshold: float) -> bool:
        if operator == ConditionOperator.GT:
            return value > threshold
        elif operator == ConditionOperator.LT:
            return value < threshold
        elif operator == ConditionOperator.GTE:
            return value >= threshold
        elif operator == ConditionOperator.LTE:
            return value <= threshold
        elif operator == ConditionOperator.EQ:
            return value == threshold
        elif operator == ConditionOperator.NEQ:
            return value != threshold
        return False

    def _fire_alert(self, rule: AlertRule, value: float) -> Alert:
        # Check if already firing
        for alert in self.alerts.values():
            if alert.rule_id == rule.id and alert.status == AlertStatus.FIRING:
                return alert

        alert = Alert(
            rule_id=rule.id,
            rule_name=rule.name,
            severity=rule.severity,
            status=AlertStatus.FIRING,
            value=value,
            threshold=rule.threshold,
            message=f"{rule.name}: {value} {rule.operator.value} {rule.threshold}",
            labels=rule.labels.copy(),
        )

        self.alerts[alert.id] = alert

        for handler in self.handlers:
            try:
                handler(alert)
            except Exception:
                pass

        return alert

    def _resolve_for_rule(self, rule_id: str) -> None:
        for alert in self.alerts.values():
            if alert.rule_id == rule_id and alert.status == AlertStatus.FIRING:
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.utcnow()

    def resolve_alert(self, alert_id: str) -> bool:
        alert = self.alerts.get(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = datetime.utcnow()
        return True

    def silence_alert(self, alert_id: str) -> bool:
        alert = self.alerts.get(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.SILENCED
        return True

    def get_firing_alerts(self) -> list[Alert]:
        return [a for a in self.alerts.values() if a.status == AlertStatus.FIRING]

    def get_alerts(
        self,
        status: Optional[AlertStatus] = None,
        severity: Optional[AlertSeverity] = None,
    ) -> list[Alert]:
        results = []
        for alert in self.alerts.values():
            if status and alert.status != status:
                continue
            if severity and alert.severity != severity:
                continue
            results.append(alert)
        return results

    def get_stats(self) -> dict:
        by_status = {}
        by_severity = {}
        for alert in self.alerts.values():
            by_status[alert.status.value] = by_status.get(alert.status.value, 0) + 1
            by_severity[alert.severity.value] = by_severity.get(alert.severity.value, 0) + 1

        return {
            "total_rules": len(self.rules),
            "total_alerts": len(self.alerts),
            "firing_alerts": sum(1 for a in self.alerts.values() if a.status == AlertStatus.FIRING),
            "by_status": by_status,
            "by_severity": by_severity,
        }
