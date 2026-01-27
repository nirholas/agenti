"""
Event routing for real-time streams.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class MatchType(Enum):
    EXACT = "exact"
    PREFIX = "prefix"
    REGEX = "regex"
    WILDCARD = "wildcard"


@dataclass
class RoutingRule:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    pattern: str = ""
    match_type: MatchType = MatchType.EXACT
    destination: str = ""
    priority: int = 0
    enabled: bool = True
    conditions: dict = field(default_factory=dict)
    transform: Optional[Callable] = None


class EventRouter:
    def __init__(self):
        self.rules: list[RoutingRule] = []
        self.destinations: dict[str, Callable] = {}
        self.default_destination: Optional[str] = None

    def add_rule(
        self,
        name: str,
        pattern: str,
        destination: str,
        match_type: MatchType = MatchType.EXACT,
        priority: int = 0,
        conditions: Optional[dict] = None,
        transform: Optional[Callable] = None,
    ) -> RoutingRule:
        rule = RoutingRule(
            name=name,
            pattern=pattern,
            destination=destination,
            match_type=match_type,
            priority=priority,
            conditions=conditions or {},
            transform=transform,
        )
        self.rules.append(rule)
        self.rules.sort(key=lambda r: r.priority, reverse=True)
        return rule

    def remove_rule(self, rule_id: str) -> bool:
        for i, rule in enumerate(self.rules):
            if rule.id == rule_id:
                self.rules.pop(i)
                return True
        return False

    def register_destination(self, name: str, handler: Callable) -> None:
        self.destinations[name] = handler

    def set_default_destination(self, name: str) -> None:
        self.default_destination = name

    def route(self, event_type: str, event: Any) -> list[str]:
        matched_destinations = []

        for rule in self.rules:
            if not rule.enabled:
                continue

            if self._matches(event_type, rule):
                if self._check_conditions(event, rule.conditions):
                    matched_destinations.append(rule.destination)

        if not matched_destinations and self.default_destination:
            matched_destinations.append(self.default_destination)

        return matched_destinations

    async def dispatch(self, event_type: str, event: Any) -> dict[str, Any]:
        destinations = self.route(event_type, event)
        results = {}

        for dest in destinations:
            handler = self.destinations.get(dest)
            if handler:
                try:
                    import asyncio
                    if asyncio.iscoroutinefunction(handler):
                        results[dest] = await handler(event)
                    else:
                        results[dest] = handler(event)
                except Exception as e:
                    results[dest] = {"error": str(e)}

        return results

    def _matches(self, event_type: str, rule: RoutingRule) -> bool:
        if rule.match_type == MatchType.EXACT:
            return event_type == rule.pattern
        elif rule.match_type == MatchType.PREFIX:
            return event_type.startswith(rule.pattern)
        elif rule.match_type == MatchType.REGEX:
            return bool(re.match(rule.pattern, event_type))
        elif rule.match_type == MatchType.WILDCARD:
            pattern = rule.pattern.replace("*", ".*").replace("?", ".")
            return bool(re.match(f"^{pattern}$", event_type))
        return False

    def _check_conditions(self, event: Any, conditions: dict) -> bool:
        if not conditions:
            return True
        if not isinstance(event, dict):
            return True

        for key, expected in conditions.items():
            actual = event.get(key)
            if isinstance(expected, dict):
                if "$gt" in expected and not (actual and actual > expected["$gt"]):
                    return False
                if "$lt" in expected and not (actual and actual < expected["$lt"]):
                    return False
                if "$in" in expected and actual not in expected["$in"]:
                    return False
            elif actual != expected:
                return False

        return True

    def get_rules(self) -> list[RoutingRule]:
        return self.rules

    def get_stats(self) -> dict:
        return {
            "total_rules": len(self.rules),
            "active_rules": sum(1 for r in self.rules if r.enabled),
            "destinations": list(self.destinations.keys()),
            "default_destination": self.default_destination,
        }
