"""
Alert Manager for Lyra Intel.
"""

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertState(Enum):
    """Alert states."""
    FIRING = "firing"
    RESOLVED = "resolved"
    SILENCED = "silenced"
    ACKNOWLEDGED = "acknowledged"


@dataclass
class Alert:
    """Represents an alert."""
    alert_id: str
    name: str
    severity: AlertSeverity
    state: AlertState
    message: str
    source: str
    labels: Dict[str, str] = field(default_factory=dict)
    annotations: Dict[str, str] = field(default_factory=dict)
    fired_at: datetime = field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    fingerprint: str = ""


@dataclass
class AlertRule:
    """Alert rule definition."""
    name: str
    condition: Callable[[Dict[str, Any]], bool]
    severity: AlertSeverity
    message_template: str
    cooldown_minutes: int = 5
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class Silence:
    """Alert silence rule."""
    silence_id: str
    matchers: Dict[str, str]  # label -> regex pattern
    starts_at: datetime
    ends_at: datetime
    created_by: str
    comment: str = ""


class AlertManager:
    """
    Manages alerts, routing, and notifications.
    
    Features:
    - Alert rule evaluation
    - Alert grouping and deduplication
    - Silence rules
    - Notification routing
    - Alert history
    """
    
    def __init__(self):
        self._rules: Dict[str, AlertRule] = {}
        self._alerts: Dict[str, Alert] = {}  # fingerprint -> alert
        self._silences: Dict[str, Silence] = {}
        self._history: List[Alert] = []
        self._handlers: List[Callable[[Alert], None]] = []
        self._last_fired: Dict[str, datetime] = {}  # rule_name -> last_fired_time
        self._alert_counts: Dict[str, int] = defaultdict(int)
    
    def add_rule(self, rule: AlertRule):
        """Add an alert rule."""
        self._rules[rule.name] = rule
        logger.info(f"Added alert rule: {rule.name}")
    
    def remove_rule(self, rule_name: str):
        """Remove an alert rule."""
        self._rules.pop(rule_name, None)
    
    def add_handler(self, handler: Callable[[Alert], None]):
        """Add an alert handler (callback on alert state change)."""
        self._handlers.append(handler)
    
    def add_silence(self, silence: Silence):
        """Add a silence rule."""
        self._silences[silence.silence_id] = silence
        logger.info(f"Added silence: {silence.silence_id}")
    
    def remove_silence(self, silence_id: str):
        """Remove a silence rule."""
        self._silences.pop(silence_id, None)
    
    async def evaluate_rules(self, metrics: Dict[str, Any]):
        """Evaluate all alert rules against current metrics."""
        now = datetime.utcnow()
        
        for rule_name, rule in self._rules.items():
            # Check cooldown
            last_fired = self._last_fired.get(rule_name)
            if last_fired:
                cooldown = timedelta(minutes=rule.cooldown_minutes)
                if now - last_fired < cooldown:
                    continue
            
            # Evaluate condition
            try:
                should_fire = rule.condition(metrics)
            except Exception as e:
                logger.error(f"Error evaluating rule {rule_name}: {e}")
                continue
            
            # Generate fingerprint
            fingerprint = self._generate_fingerprint(rule_name, rule.labels)
            
            existing_alert = self._alerts.get(fingerprint)
            
            if should_fire:
                if not existing_alert or existing_alert.state == AlertState.RESOLVED:
                    # Fire new alert
                    alert = self._fire_alert(rule, fingerprint, metrics)
                    await self._notify_handlers(alert)
                    self._last_fired[rule_name] = now
            else:
                if existing_alert and existing_alert.state == AlertState.FIRING:
                    # Resolve alert
                    await self._resolve_alert(fingerprint)
    
    def _fire_alert(
        self,
        rule: AlertRule,
        fingerprint: str,
        metrics: Dict[str, Any],
    ) -> Alert:
        """Fire an alert."""
        import uuid
        
        message = rule.message_template.format(**metrics)
        
        alert = Alert(
            alert_id=str(uuid.uuid4())[:8],
            name=rule.name,
            severity=rule.severity,
            state=AlertState.FIRING,
            message=message,
            source="lyra-intel",
            labels=rule.labels.copy(),
            fingerprint=fingerprint,
        )
        
        # Check if silenced
        if self._is_silenced(alert):
            alert.state = AlertState.SILENCED
        
        self._alerts[fingerprint] = alert
        self._history.append(alert)
        self._alert_counts[rule.name] += 1
        
        logger.warning(f"Alert fired: {alert.name} - {alert.message}")
        
        return alert
    
    async def _resolve_alert(self, fingerprint: str):
        """Resolve an alert."""
        alert = self._alerts.get(fingerprint)
        if not alert:
            return
        
        alert.state = AlertState.RESOLVED
        alert.resolved_at = datetime.utcnow()
        
        logger.info(f"Alert resolved: {alert.name}")
        
        await self._notify_handlers(alert)
    
    def _generate_fingerprint(self, rule_name: str, labels: Dict[str, str]) -> str:
        """Generate unique fingerprint for an alert."""
        import hashlib
        
        parts = [rule_name] + [f"{k}={v}" for k, v in sorted(labels.items())]
        return hashlib.md5("|".join(parts).encode()).hexdigest()[:16]
    
    def _is_silenced(self, alert: Alert) -> bool:
        """Check if alert matches any silence rule."""
        import re
        
        now = datetime.utcnow()
        
        for silence in self._silences.values():
            # Check time range
            if not (silence.starts_at <= now <= silence.ends_at):
                continue
            
            # Check matchers
            matches = True
            for label, pattern in silence.matchers.items():
                value = alert.labels.get(label, "")
                if not re.match(pattern, value):
                    matches = False
                    break
            
            if matches:
                return True
        
        return False
    
    async def _notify_handlers(self, alert: Alert):
        """Notify all handlers of alert state change."""
        for handler in self._handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(alert)
                else:
                    handler(alert)
            except Exception as e:
                logger.error(f"Error in alert handler: {e}")
    
    def acknowledge_alert(self, fingerprint: str, by: str):
        """Acknowledge an alert."""
        alert = self._alerts.get(fingerprint)
        if alert and alert.state == AlertState.FIRING:
            alert.state = AlertState.ACKNOWLEDGED
            alert.annotations["acknowledged_by"] = by
            alert.annotations["acknowledged_at"] = datetime.utcnow().isoformat()
            logger.info(f"Alert acknowledged: {alert.name} by {by}")
    
    def get_firing_alerts(self) -> List[Alert]:
        """Get all currently firing alerts."""
        return [
            a for a in self._alerts.values()
            if a.state == AlertState.FIRING
        ]
    
    def get_alert_history(
        self,
        limit: int = 100,
        severity: Optional[AlertSeverity] = None,
    ) -> List[Alert]:
        """Get alert history."""
        history = self._history
        
        if severity:
            history = [a for a in history if a.severity == severity]
        
        return history[-limit:]
    
    def get_alert_stats(self) -> Dict[str, Any]:
        """Get alert statistics."""
        firing = [a for a in self._alerts.values() if a.state == AlertState.FIRING]
        
        by_severity = defaultdict(int)
        for alert in firing:
            by_severity[alert.severity.value] += 1
        
        return {
            "total_firing": len(firing),
            "by_severity": dict(by_severity),
            "total_silenced": len([a for a in self._alerts.values() if a.state == AlertState.SILENCED]),
            "total_acknowledged": len([a for a in self._alerts.values() if a.state == AlertState.ACKNOWLEDGED]),
            "active_silences": len(self._silences),
            "alert_counts": dict(self._alert_counts),
        }
    
    def setup_default_rules(self):
        """Setup default alert rules."""
        # High complexity alert
        self.add_rule(AlertRule(
            name="high_complexity",
            condition=lambda m: m.get("max_cyclomatic", 0) > 50,
            severity=AlertSeverity.WARNING,
            message_template="High complexity detected: max cyclomatic = {max_cyclomatic}",
            labels={"category": "quality"},
        ))
        
        # Security issue alert
        self.add_rule(AlertRule(
            name="security_issue",
            condition=lambda m: m.get("security_issues", 0) > 0,
            severity=AlertSeverity.CRITICAL,
            message_template="Security issues found: {security_issues} issue(s)",
            labels={"category": "security"},
        ))
        
        # Large file alert
        self.add_rule(AlertRule(
            name="large_file",
            condition=lambda m: m.get("max_file_lines", 0) > 1000,
            severity=AlertSeverity.INFO,
            message_template="Large file detected: {max_file_lines} lines",
            labels={"category": "quality"},
        ))
        
        # Dead code alert
        self.add_rule(AlertRule(
            name="dead_code",
            condition=lambda m: m.get("dead_code_count", 0) > 10,
            severity=AlertSeverity.WARNING,
            message_template="Dead code detected: {dead_code_count} items",
            labels={"category": "quality"},
        ))
